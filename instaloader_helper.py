#!/usr/bin/env python3
"""
Instaloader Helper Script for Instagram Analytics App
Fetches ALL post metadata for a given username and outputs JSON to stdout.
Usage: python instaloader_helper.py <username> [--count N] [--userid ID] [--sessionid S] [--csrftoken T] [--cookies C]
                                   [--max-pages N] [--start-max-id CURSOR]
       If --count is not specified, fetches ALL posts — the feed walk now runs
       to the account's first post instead of stopping at a page cap.

       --max-pages   : explicit page cap (quick peek). Omit for full history.
       --start-max-id: resume a previously interrupted walk from this cursor
                       (the value is echoed back as lastMaxId / scan.lastMaxId).

       --userid   : Skip the (often blocked) web_profile_info username lookup
                    and resolve the profile via the working mobile users/{id}/info
                    endpoint instead. Passed automatically by the app when a
                    user ID is already known.
       --sessionid / --csrftoken / --cookies : Optional Instagram session from
                    the app's Settings > Instagram Login. Authenticated requests
                    are not subject to Instagram's anonymous access blocks.
"""

import sys
import json
import os
import re
import time
import tempfile
import shutil

try:
    import requests
except ImportError:
    requests = None


# Absolute ceiling for a history walk. It exists purely so a misbehaving feed
# cannot loop forever — it is NOT a truncation limit: a real account would need
# 1000 x 50 = 50,000 posts to reach it.
HARD_MAX_PAGES = 1000


def setup_stdout():
    """Force UTF-8 output so captions with emoji survive Windows' default
    console encoding (cp1252) when the app parses our stdout as UTF-8."""
    for stream in (sys.stdout, sys.stderr):
        try:
            reconfigure = getattr(stream, 'reconfigure', None)
            if reconfigure:
                reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


def parse_args(argv):
    username = None
    count = None
    userid = None
    sessionid = None
    csrftoken = None
    cookies = None
    max_pages = None
    start_max_id = None
    i = 0
    args = list(argv)
    while i < len(args):
        a = args[i]
        if a == '--count' and i + 1 < len(args):
            try:
                count = int(args[i + 1])
            except (IndexError, ValueError):
                pass
            i += 2
        elif a == '--max-pages' and i + 1 < len(args):
            # Explicit cap for callers that want a quick peek instead of the
            # full history walk.
            try:
                max_pages = int(args[i + 1])
            except (IndexError, ValueError):
                pass
            i += 2
        elif a == '--start-max-id' and i + 1 < len(args):
            # Resume point from a previous partial walk.
            start_max_id = args[i + 1]
            i += 2
        elif a == '--userid' and i + 1 < len(args):
            userid = args[i + 1]
            i += 2
        elif a == '--sessionid' and i + 1 < len(args):
            sessionid = args[i + 1]
            i += 2
        elif a == '--csrftoken' and i + 1 < len(args):
            csrftoken = args[i + 1]
            i += 2
        elif a == '--cookies' and i + 1 < len(args):
            cookies = args[i + 1]
            i += 2
        elif a.startswith('-'):
            i += 1
        else:
            if username is None:
                username = a
            i += 1
    return username, count, userid, sessionid, csrftoken, cookies, max_pages, start_max_id


def apply_session_cookies(loader, sessionid, csrftoken, cookies):
    """Inject a saved Instagram session into instaloader's requests session."""
    session = getattr(loader, 'context', None)
    if session is None:
        return
    s = session._session
    if not s:
        return
    try:
        if sessionid:
            s.cookies.set('sessionid', sessionid, domain='.instagram.com')
        if csrftoken:
            s.cookies.set('csrftoken', csrftoken, domain='.instagram.com')
        if cookies:
            for part in cookies.split(';'):
                part = part.strip()
                if '=' in part:
                    k, v = part.split('=', 1)
                    s.cookies.set(k.strip(), v.strip(), domain='.instagram.com')
    except Exception as e:
        print("[WARN] Could not apply session cookies: %s" % str(e)[:100], file=sys.stderr)


def resolve_user_id_from_html(username):
    """Try to extract the numeric user ID from the public profile HTML page."""
    if requests is None:
        return None
    patterns = [
        r'"profilePage_(\d+)"',
        r'"user_id":"?(\d+)"?',
        r'"pk":"?(\d+)"?',
        r'"userid":(\d+)',
        r'"id":"(\d+)","username":"' + re.escape(username) + '"',
    ]
    try:
        resp = requests.get(
            'https://www.instagram.com/' + username + '/',
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                              '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
            },
            timeout=8,
        )
        html = resp.text
        for pat in patterns:
            m = re.search(pat, html)
            if m:
                return m.group(1)
    except Exception as e:
        print("[WARN] HTML user-id resolution failed: %s" % str(e)[:100], file=sys.stderr)
    return None


def build_profile_from_id(loader, il, userid):
    """Construct an instaloader Profile directly from the mobile users/{id}/info endpoint.
    This works even when Instagram blocks the anonymous web_profile_info endpoint."""
    if not userid:
        return None
    try:
        data = loader.context.get_json("api/v1/users/{0}/info/".format(str(userid)), params={})
        user = (data or {}).get('user')
        if user and user.get('username'):
            profile = il.Profile(loader.context, user)
            # Mark as fully loaded to avoid extra metadata requests
            try:
                profile._has_full_metadata = True
            except Exception:
                pass
            # Keep the raw mobile-API user dict around: instaloader's properties
            # (e.g. mediacount) read GraphQL-only keys that the mobile response
            # spells differently (media_count), so we use these as a fallback.
            try:
                profile._raw_user = user
            except Exception:
                pass
            return profile
    except Exception as e:
        print("[WARN] users/{0}/info/ failed: {1}".format(userid, str(e)[:100]), file=sys.stderr)
    return None


def safe_attr(obj, name, default=None):
    """getattr that also swallows KeyError/TypeError raised inside instaloader
    property getters when the underlying node dict lacks expected keys."""
    try:
        return getattr(obj, name, default)
    except Exception:
        return default


def map_mobile_item(item):
    """Map a Mobile API v1 feed item to the app's post format (full data)."""
    shortcode = item.get('code') or item.get('shortcode') or ''
    if not shortcode:
        return None
    media_type = item.get('media_type')  # 1 photo, 2 video, 8 carousel
    product_type = item.get('product_type') or ''
    if media_type == 8:
        post_type = 'carousel'
    elif product_type == 'clips':
        post_type = 'reel'
    elif media_type == 2:
        post_type = 'video'
    else:
        post_type = 'photo'

    caption = ((item.get('caption') or {}) or {}).get('text') or ''
    hashtags = list(dict.fromkeys(re.findall(r'#[\w]+', caption)))
    mentions = list(dict.fromkeys(re.findall(r'@[\w.]+', caption)))

    thumb = ''
    cands = (item.get('image_versions2') or {}).get('candidates') or []
    if cands:
        thumb = max(cands, key=lambda c: c.get('width') or 0).get('url') or ''

    video_url = ''
    vids = item.get('video_versions') or []
    if vids:
        video_url = vids[0].get('url') or ''

    typename = {1: 'GraphImage', 2: 'GraphVideo', 8: 'GraphSidecar'}.get(media_type)

    return {
        "shortcode": shortcode,
        "thumbnail": thumb,
        "likes": item.get('like_count'),
        "like_count": item.get('like_count'),
        "comments": item.get('comment_count'),
        "comment_count": item.get('comment_count'),
        "caption": caption,
        "hashtags": hashtags,
        "mentions": mentions,
        "taggedUsers": [],
        "isVideo": media_type == 2,
        "postType": post_type,
        "carouselCount": item.get('carousel_media_count') or 0,
        "timestamp": item.get('taken_at'),
        "typename": typename,
        "videoUrl": video_url or None,
        "videoViews": item.get('view_count') or item.get('play_count') or None,
        "video_view_count": item.get('view_count') or item.get('play_count') or None,
        "videoDuration": item.get('video_duration'),
        "location": ((item.get('location') or {}).get('name') or ''),
        "url": "https://www.instagram.com/p/{0}/".format(shortcode),
    }


def fetch_posts_via_feed_api(userid, count=None, sessionid=None, csrftoken=None, cookies=None,
                             max_pages=None, start_max_id=None):
    """Fetch EVERY post of the account via the Mobile API v1 feed endpoint.

    The walk stops only when Instagram reports `more_available == false`, i.e.
    when it reaches the account's very first post — there is no built-in page
    limit any more (the old 25-page cap silently truncated large accounts at
    1,250 posts). Pass --max-pages to impose an explicit cap.

    Returns (posts, feed_user_dict_or_None, meta) where meta is:
        {"complete": bool, "pages": int, "lastMaxId": str|None,
         "stoppedReason": str}
    `complete` is False whenever the history is only PARTIALLY covered, and the
    caller must never present a partial walk as "all posts".
    """
    if requests is None or not userid:
        return [], None, {"complete": False, "pages": 0, "lastMaxId": None,
                          "stoppedReason": "no_requests_module"}

    headers = {
        'User-Agent': 'Instagram 317.0.0.0.35 Android (30/11; 420dpi; 1080x2187; OnePlus; 6T; OnePlus6T; qcom; en_US; 474786801)',
        'X-IG-App-ID': '567067343352427',
        'Accept': '*/*',
        'Accept-Language': 'en-US',
    }
    if cookies:
        headers['Cookie'] = cookies
    elif sessionid or csrftoken:
        cookie_parts = []
        if sessionid:
            cookie_parts.append('sessionid=' + sessionid)
        if csrftoken:
            cookie_parts.append('csrftoken=' + csrftoken)
        if cookie_parts:
            headers['Cookie'] = '; '.join(cookie_parts)

    posts = []
    feed_user = None
    next_max_id = start_max_id or None
    page = 0
    complete = False
    stopped_reason = 'exhausted'
    hard_cap = max_pages if max_pages else HARD_MAX_PAGES
    if max_pages:
        print("[INFO] Feed walk explicitly capped at %s page(s)" % max_pages, file=sys.stderr)

    def consume(payload):
        """Map and append a feed page. Returns (more_available, next_id)."""
        items = payload.get('items') or []
        for item in items:
            post = map_mobile_item(item)
            if post:
                posts.append(post)
        if payload.get('more_available') and payload.get('next_max_id'):
            return True, payload['next_max_id']
        return False, None

    while page < hard_cap:
        path = "https://i.instagram.com/api/v1/feed/user/{0}/?count=50".format(str(userid))
        if next_max_id:
            path += "&max_id=" + str(next_max_id)

        data = None
        # ── Fetch one page, retrying throttling (401/403/429) and network blips ──
        for attempt in range(0, 4):
            try:
                resp = requests.get(path, headers=headers, timeout=25)
                if resp.status_code == 200:
                    data = resp.json()
                    break
                if resp.status_code in (401, 403, 429):
                    wait = 3 + 2 * (attempt + 1)  # 5s, 7s, 9s
                    print("[WARN] Feed API %s on page %s - retrying in %ss (attempt %s/3)"
                          % (resp.status_code, page, wait, attempt + 1), file=sys.stderr)
                    time.sleep(wait)
                    continue
                print("[WARN] Feed API returned %s on page %s" % (resp.status_code, page), file=sys.stderr)
                stopped_reason = 'http_%s' % resp.status_code
                break
            except Exception as e:
                wait = 2 + 2 * (attempt + 1)
                print("[WARN] Feed API page %s error (%s) - retrying in %ss (attempt %s/3)"
                      % (page, str(e)[:80], wait, attempt + 1), file=sys.stderr)
                time.sleep(wait)

        if data is None:
            if stopped_reason == 'exhausted':
                stopped_reason = 'network_error'
            print("[WARN] Feed walk stopped on page %s with %s posts collected"
                  % (page, len(posts)), file=sys.stderr)
            break

        if feed_user is None and data.get('user'):
            feed_user = data['user']

        more_available, next_id = consume(data)
        page += 1
        if page % 10 == 0:
            print("[INFO] Feed walk: %s posts across %s pages..." % (len(posts), page), file=sys.stderr)

        if count is not None and len(posts) >= count:
            stopped_reason = 'count-cap'
            next_max_id = next_id
            break

        if not more_available or not next_id:
            complete = True
            stopped_reason = 'exhausted'
            next_max_id = None
            break
        next_max_id = next_id
        time.sleep(0.8)
    else:
        # while-loop ended because the page cap was reached
        if not complete:
            stopped_reason = 'page-cap'

    if len(posts) == 0 and stopped_reason == 'exhausted':
        stopped_reason = 'empty'

    meta = {
        "complete": bool(complete),
        "pages": page,
        "lastMaxId": next_max_id,
        "stoppedReason": stopped_reason,
    }
    print("[INFO] Feed walk %s: %s posts, %s page(s), reason=%s"
          % ("COMPLETE" if complete else "PARTIAL", len(posts), page, stopped_reason), file=sys.stderr)
    return posts, feed_user, meta


def build_post_data(post):
    """Extract the full set of fields instaloader provides for a single post."""
    is_video = post.is_video
    is_carousel = post.typename == "GraphSidecar"

    if is_carousel and is_video:
        post_type = "reel"
    elif is_video:
        post_type = "video"
    elif is_carousel:
        post_type = "carousel"
    else:
        post_type = "photo"

    hashtags = list(getattr(post, 'caption_hashtags', None) or [])
    mentions = list(getattr(post, 'caption_mentions', None) or [])
    tagged_users = list(getattr(post, 'tagged_users', None) or [])

    location_obj = getattr(post, 'location', None)
    location_name = ""
    if location_obj:
        location_name = getattr(location_obj, 'name', '') or str(location_obj) or ""

    video_views = getattr(post, 'view_count', None) if is_video else None
    video_duration = getattr(post, 'video_duration', None)
    if video_duration is not None:
        try:
            video_duration = int(video_duration)
        except (TypeError, ValueError):
            video_duration = None

    carousel_count = 0
    if is_carousel:
        carousel_count = len(getattr(post, 'sidecar_nodes', []) or [])

    post_url = "https://www.instagram.com/p/{0}/".format(post.shortcode)

    return {
        "shortcode": post.shortcode,
        "thumbnail": post.url or "",
        "likes": post.likes,
        "like_count": post.likes,  # Alias for backward compat
        "comments": post.comments,
        "comment_count": post.comments,  # Alias for backward compat
        "caption": post.caption or "",
        "hashtags": hashtags,
        "mentions": mentions,
        "taggedUsers": tagged_users,
        "isVideo": is_video,
        "postType": post_type,
        "carouselCount": carousel_count,
        "timestamp": int(post.date_utc.timestamp()) if post.date_utc else None,
        "typename": post.typename,
        "videoUrl": post.video_url if is_video else None,
        "videoViews": video_views,
        "video_view_count": video_views,  # Alias for backward compat
        "videoDuration": video_duration,
        "location": location_name,
        "url": post_url,
    }


def main():
    setup_stdout()
    (username, count, userid, sessionid, csrftoken, cookies,
     max_pages, start_max_id) = parse_args(sys.argv[1:])

    if not username:
        print(json.dumps({"error": "Usage: instaloader_helper.py <username> [--count N] [--userid ID] [--sessionid S] [--max-pages N] [--start-max-id CURSOR]"}))
        sys.exit(1)

    username = username.strip().lstrip('@')

    try:
        import instaloader
    except ImportError:
        # Also echo the module marker on stderr - scraping.js listens on stderr
        # to auto-install instaloader when it is missing.
        print("[WARN] No module named instaloader - run: pip install instaloader", file=sys.stderr)
        print(json.dumps({"error": "instaloader not installed. Run: pip install instaloader"}))
        sys.exit(1)

    # Create a temporary directory for output (cleanup happens in finally)
    temp_dir = tempfile.mkdtemp(prefix='instaloader_')

    try:
        # Initialize Instaloader with minimal output - output to temp_dir
        loader = instaloader.Instaloader(
            quiet=True,
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            post_metadata_txt_pattern='',
            dirname_pattern=os.path.join(temp_dir, '{profile}'),
            filename_pattern='{date_utc}_UTC',
            max_connection_attempts=3,
            request_timeout=30,
        )

        # Inject saved session cookies if provided (Settings > Instagram Login)
        if sessionid or csrftoken or cookies:
            apply_session_cookies(loader, sessionid, csrftoken, cookies)

        # ── Resolve the profile (multiple strategies) ────────────────────────
        profile = None
        resolved_userid = None

        # Strategy A: known user ID → build directly from mobile users/{id}/info
        if userid:
            resolved_userid = str(userid).strip()
            profile = build_profile_from_id(loader, instaloader, resolved_userid)
            if profile:
                print("[INFO] Resolved profile @%s via users/{id}/info (userid %s)" % (profile.username, resolved_userid), file=sys.stderr)

        # Strategy B: standard instaloader username lookup (works when not blocked / when logged in)
        if profile is None:
            try:
                profile = instaloader.Profile.from_username(loader.context, username)
                if profile and profile.username:
                    resolved_userid = str(profile.userid) if profile.userid else None
                    print("[INFO] Resolved profile @%s via from_username" % profile.username, file=sys.stderr)
            except instaloader.exceptions.ProfileNotExistsException:
                print(json.dumps({"error": "Profile @%s not found" % username}))
                sys.exit(1)
            except instaloader.exceptions.ConnectionException as e:
                print("[WARN] from_username connection issue: %s" % str(e)[:120], file=sys.stderr)
            except Exception as e:
                print("[WARN] from_username failed (Instagram blocks anonymous lookup?): %s" % str(e)[:120], file=sys.stderr)

        # Strategy C: try HTML-based user ID resolution, then build from ID
        if profile is None:
            uid = resolve_user_id_from_html(username)
            if uid:
                resolved_userid = str(uid)
                profile = build_profile_from_id(loader, instaloader, resolved_userid)
                if profile:
                    print("[INFO] Resolved profile @%s via HTML user-id lookup" % profile.username, file=sys.stderr)

        if profile is None:
            print(json.dumps({"error":
                "Instagram blocked anonymous profile lookup for @%s. "
                "Log in via Settings > Instagram Login for full access, then try again." % username}))
            sys.exit(1)

        if safe_attr(profile, 'is_private', False):
            print(json.dumps({"error": "@%s is a private account" % username}))
            sys.exit(1)

        # ── Fetch posts ──────────────────────────────────────────────────────
        posts = []
        post_count = 0
        total_media = safe_attr(profile, 'mediacount', 0) or 0
        raw_user = safe_attr(profile, '_raw_user', None) or {}
        if not total_media and raw_user:
            total_media = raw_user.get('media_count') or raw_user.get('mediaCount') or 0
        print("[INFO] Profile has %s total posts" % total_media, file=sys.stderr)

        # Primary: instaloader get_posts() (full metadata incl. captions/hashtags).
        # Skip when the profile was built from the mobile users/{id}/info dict:
        # instaloader's get_posts() reads GraphQL-only keys (edge_owner_to_timeline_media)
        # that the mobile dict lacks, so it would always fail - go straight to
        # the Mobile API feed which returns the identical data set.
        built_from_mobile = bool(safe_attr(profile, '_raw_user', None))
        walk_complete = False
        walk_reason = 'instaloader_pagination'
        if not built_from_mobile:
            try:
                for post in profile.get_posts():
                    if count is not None and post_count >= count:
                        walk_reason = 'count-cap'
                        break
                    posts.append(build_post_data(post))
                    post_count += 1
                    if post_count % 25 == 0:
                        print("[INFO] Fetched %s/%s posts..." % (post_count, total_media), file=sys.stderr)
                else:
                    # The generator ran out of posts — we reached the account's
                    # first post, so this really is the full history.
                    walk_complete = True
            except Exception as e:
                # Catch all (incl. instaloader's InstaloaderException hierarchy across versions)
                walk_reason = 'pagination_error'
                print("[WARN] Exception after %s posts: %s" % (post_count, str(e)[:100]), file=sys.stderr)
        else:
            print("[INFO] Profile built from mobile info - using Mobile API feed directly", file=sys.stderr)

        # Fallback: if get_posts returned nothing (GraphQL blocked), use the
        # Mobile API feed endpoint which returns the same full data set.
        feed_user = None
        scan_meta = {
            "complete": bool(walk_complete),
            "pages": None,
            "lastMaxId": None,
            "stoppedReason": walk_reason if posts else 'none',
        }
        if not posts and (resolved_userid or userid):
            feed_userid = resolved_userid or str(userid).strip()
            print("[INFO] Falling back to Mobile API feed for userid %s" % feed_userid, file=sys.stderr)
            posts, feed_user, feed_meta = fetch_posts_via_feed_api(
                feed_userid, count, sessionid, csrftoken, cookies,
                max_pages=max_pages, start_max_id=start_max_id,
            )
            if feed_meta:
                scan_meta = feed_meta

        # Build profile info from the instaloader Profile object (safe attribute access)
        profile_info = {
            "username": safe_attr(profile, 'username') or username,
            "fullName": safe_attr(profile, 'full_name') or '',
            "bio": safe_attr(profile, 'biography') or '',
            "profilePicUrl": safe_attr(profile, 'profile_pic_url') or '',
            "followers": safe_attr(profile, 'followers'),
            "following": safe_attr(profile, 'followees'),
            "posts": total_media,
            "isVerified": bool(safe_attr(profile, 'is_verified', False)),
            "isPrivate": bool(safe_attr(profile, 'is_private', False)),
            "externalUrl": safe_attr(profile, 'external_url') or '',
            "fetchedAt": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat() + "Z",
        }

        # The anonymous mobile info/feed responses omit follower counts but DO
        # include full_name / profile pic / verified / private. When a session is
        # provided, users/{id}/info also returns follower_count / following_count /
        # biography / external_url. Fill those gaps so the app's profile card is
        # complete (and the logged-in path early-returns in scrapeProfile).
        if feed_user or raw_user:
            fill = feed_user or raw_user or {}
            if not profile_info["fullName"]:
                profile_info["fullName"] = fill.get('full_name') or ''
            if not profile_info["profilePicUrl"]:
                profile_info["profilePicUrl"] = fill.get('profile_pic_url') or ''
            if not profile_info["isVerified"]:
                profile_info["isVerified"] = bool(fill.get('is_verified'))
            if not profile_info["isPrivate"]:
                profile_info["isPrivate"] = bool(fill.get('is_private'))
            if profile_info["followers"] in (None, ''):
                profile_info["followers"] = fill.get('follower_count')
            if profile_info["following"] in (None, ''):
                profile_info["following"] = fill.get('following_count')
            if not profile_info["bio"]:
                profile_info["bio"] = fill.get('biography') or ''
            if not profile_info["externalUrl"]:
                profile_info["externalUrl"] = fill.get('external_url') or ''

        # Report a realistic post count: the anonymous mobile endpoints don't
        # expose total media count, but we DID fetch posts - use their count.
        if not total_media and posts:
            profile_info["posts"] = len(posts)

        # Expose the resolved numeric user ID so the app can cache it and pass
        # it back on the next scan (skipping the blocked username lookup).
        if resolved_userid:
            profile_info["userId"] = str(resolved_userid)
        elif raw_user:
            uid = raw_user.get('pk') or raw_user.get('id')
            if uid:
                profile_info["userId"] = str(uid)

        result = {
            "profile": profile_info,
            "posts": posts,
            "source": "instaloader",
            "postCount": len(posts),
            # Whether this walk reached the account's FIRST post. Consumers must
            # treat complete=false as "partial history" and resume with
            # --start-max-id rather than presenting it as every post.
            "complete": bool(scan_meta.get("complete")),
            "lastMaxId": scan_meta.get("lastMaxId"),
            "scan": scan_meta,
        }

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": "Unexpected error: %s" % str(e)}))
        sys.exit(1)

    finally:
        # Clean up temporary directory
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


if __name__ == "__main__":
    main()
