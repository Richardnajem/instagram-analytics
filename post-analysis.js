// SWA - Post Analysis Module
// Comprehensive post analysis with multiple methods
// Extends InstagramAnalytics.prototype

(function() {
'use strict';
const P = InstagramAnalytics.prototype;

/* ═══════════════════════════════════════════════════════════════════
   POST ANALYSIS ENGINE — Multiple Analysis Methods
   Analyzes posts using the best method for each scenario
═══════════════════════════════════════════════════════════════════ */

/**
 * Master post analysis function - combines multiple analysis methods
 * Uses the best method for each scenario. Supports ALL posts (no limit).
 */
P.analyzePostsComprehensive = function(profile, posts) {
    if (!posts || posts.length === 0) return null;
    
    const analysis = {
        // Core metrics
        totalPosts: posts.length,
        profile: profile,
        
        // Analysis results from different methods
        contentPerformance: this.analyzeContentPerformance(profile, posts),
        bestTimeAnalysis: this.analyzeBestPostingTimes(profile, posts),
        hashtagPerformance: this.analyzeHashtagPerformance(profile, posts),
        contentTypeComparison: this.analyzeContentTypeComparison(profile, posts),
        engagementPatterns: this.analyzeEngagementPatterns(profile, posts),
        competitorBenchmark: this.analyzeCompetitorBenchmark(profile, posts),
        
        // NEW: Advanced analysis methods for full profile scans
        growthTrajectory: this.analyzeGrowthTrajectory(profile, posts),
        contentConsistency: this.analyzeContentConsistency(profile, posts),
        viralPotential: this.analyzeViralPotential(profile, posts),
        
        // Combined insights
        insights: [],
        recommendations: [],
        score: 0
    };
    
    // Generate combined insights from all analyses
    analysis.insights = this.generateCombinedInsights(analysis);
    analysis.recommendations = this.generateSmartRecommendations(analysis);
    analysis.score = this.calculateOverallScore(analysis);
    
    return analysis;
};

/**
 * Growth Trajectory Analysis
 * Analyzes posting frequency trends, engagement velocity over time
 */
P.analyzeGrowthTrajectory = function(profile, posts) {
    const results = {
        postingFrequency: 0,
        postsPerWeek: 0,
        frequencyTrend: 'stable',
        engagementVelocity: 0,
        timeSpanDays: 0,
        insights: []
    };
    
    if (posts.length < 2) return results;
    
    // Calculate time span
    const timestamps = posts.filter(p => p.timestamp).map(p => p.timestamp * 1000).sort((a, b) => a - b);
    if (timestamps.length < 2) return results;
    
    const firstPost = timestamps[0];
    const lastPost = timestamps[timestamps.length - 1];
    results.timeSpanDays = Math.round((lastPost - firstPost) / (1000 * 60 * 60 * 24));
    
    // Posts per week
    if (results.timeSpanDays > 0) {
        results.postsPerWeek = ((posts.length / results.timeSpanDays) * 7).toFixed(1);
        results.postingFrequency = posts.length;
    }
    
    // Engagement velocity (compare first half vs second half)
    const sortedPosts = [...posts].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const mid = Math.floor(sortedPosts.length / 2);
    const firstHalf = sortedPosts.slice(0, mid);
    const secondHalf = sortedPosts.slice(mid);
    
    const avgEngFirst = firstHalf.length > 0 ? firstHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / firstHalf.length : 0;
    const avgEngSecond = secondHalf.length > 0 ? secondHalf.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / secondHalf.length : 0;
    
    results.engagementVelocity = avgEngFirst > 0 ? ((avgEngSecond - avgEngFirst) / avgEngFirst * 100).toFixed(1) : 0;
    
    if (results.engagementVelocity > 20) results.frequencyTrend = 'accelerating';
    else if (results.engagementVelocity < -20) results.frequencyTrend = 'decelerating';
    
    // Insights
    if (results.timeSpanDays > 90) {
        results.insights.push(`📅 Profile spans ${results.timeSpanDays} days of content`);
    }
    if (parseFloat(results.postsPerWeek) < 1) {
        results.insights.push('⚠️ Posting less than once per week — algorithm may deprioritize');
    } else if (parseFloat(results.postsPerWeek) >= 4) {
        results.insights.push('✅ Strong posting frequency (4+/week)');
    }
    
    return results;
};

/**
 * Content Consistency Analysis
 * Measures how consistent the content quality is across all posts
 */
P.analyzeContentConsistency = function(profile, posts) {
    const results = {
        engagementConsistency: 0,
        typeDistribution: {},
        consistencyScore: 0,
        insights: []
    };
    
    if (posts.length < 3) return results;
    
    // Calculate engagement consistency (coefficient of variation)
    const engagements = posts.map(p => (p.likes || 0) + (p.comments || 0));
    const mean = engagements.reduce((s, v) => s + v, 0) / engagements.length;
    const variance = engagements.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / engagements.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? (stdDev / mean) : 0;
    
    results.engagementConsistency = Math.max(0, Math.min(100, (1 - cv) * 100));
    
    // Content type distribution
    posts.forEach(p => {
        const type = p.postType || 'photo';
        results.typeDistribution[type] = (results.typeDistribution[type] || 0) + 1;
    });
    
    // Consistency score (0-100)
    results.consistencyScore = Math.round(results.engagementConsistency);
    
    // Insights
    if (results.consistencyScore > 70) {
        results.insights.push('✅ Consistent content quality across all posts');
    } else if (results.consistencyScore < 40) {
        results.insights.push('⚠️ Inconsistent engagement — focus on replicating top-performing content');
    }
    
    return results;
};

/**
 * Viral Potential Analysis
 * Identifies posts with viral characteristics and predicts viral potential
 */
P.analyzeViralPotential = function(profile, posts) {
    const results = {
        viralPosts: [],
        viralScore: 0,
        topViralFormats: [],
        insights: []
    };
    
    if (posts.length === 0) return results;
    
    const followers = profile.followers || 0;
    if (followers === 0) return results;
    
    // Calculate engagement rate for each post
    const postsWithER = posts.map(p => {
        const eng = (p.likes || 0) + (p.comments || 0);
        const er = followers > 0 ? (eng / followers * 100) : 0;
        return { ...p, engagementRate: er, totalEngagement: eng };
    });
    
    // Find viral posts (ER > 5x average)
    const avgER = postsWithER.reduce((s, p) => s + p.engagementRate, 0) / postsWithER.length;
    results.viralPosts = postsWithER.filter(p => p.engagementRate > avgER * 3).sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 5);
    
    // Viral score (0-100)
    results.viralScore = Math.min(100, Math.round(results.viralPosts.length * 20));
    
    // Top viral formats
    if (results.viralPosts.length > 0) {
        const typeCounts = {};
        results.viralPosts.forEach(p => {
            const type = p.postType || 'photo';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        results.topViralFormats = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));
    }
    
    // Insights
    if (results.viralPosts.length > 0) {
        results.insights.push(`🚀 ${results.viralPosts.length} posts show viral potential (3x+ avg ER)`);
    }
    if (results.topViralFormats.length > 0) {
        results.insights.push(`📊 Best viral format: ${results.topViralFormats[0].type}`);
    }
    
    return results;
};

/**
 * Content Performance Score Analysis
 * Scores each post based on multiple factors
 */
P.analyzeContentPerformance = function(profile, posts) {
    const followers = profile.followers || 0;
    const results = {
        postScores: [],
        averageScore: 0,
        topPerformers: [],
        underPerformers: [],
        insights: []
    };
    
    if (posts.length === 0) return results;
    
    // Calculate baseline metrics
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    const avgLikes = totalLikes / posts.length;
    const avgComments = totalComments / posts.length;
    
    // Score each post
    results.postScores = posts.map(post => {
        const likes = post.likes || 0;
        const comments = post.comments || 0;
        const engRate = followers > 0 ? ((likes + comments) / followers * 100) : 0;
        
        // Multi-factor scoring (0-100)
        let score = 0;
        
        // 1. Engagement Rate Score (30 points)
        const engScore = Math.min(30, engRate * 10);
        score += engScore;
        
        // 2. Likes vs Average (20 points)
        const likesVsAvg = avgLikes > 0 ? (likes / avgLikes) : 1;
        score += Math.min(20, likesVsAvg * 10);
        
        // 3. Comments vs Average (20 points)
        const commentsVsAvg = avgComments > 0 ? (comments / avgComments) : 1;
        score += Math.min(20, commentsVsAvg * 10);
        
        // 4. Content Type Bonus (15 points)
        const typeBonus = {
            'reel': 15,
            'carousel': 12,
            'video': 10,
            'photo': 8
        };
        score += typeBonus[post.postType] || 8;
        
        // 5. Caption Quality (15 points)
        const caption = post.caption || '';
        let captionScore = 0;
        if (caption.length > 150) captionScore += 5;
        if (caption.includes('#')) captionScore += 5;
        if (/[!?]$/.test(caption) || /\?$/.test(caption)) captionScore += 5;
        score += Math.min(15, captionScore);
        
        // Determine performance tier
        let tier, tierColor;
        if (score >= 70) { tier = 'Excellent'; tierColor = '#10b981'; }
        else if (score >= 50) { tier = 'Good'; tierColor = '#34d399'; }
        else if (score >= 30) { tier = 'Average'; tierColor = '#facc15'; }
        else { tier = 'Needs Work'; tierColor = '#ef4444'; }
        
        return {
            post,
            score: Math.round(score),
            tier,
            tierColor,
            engRate: engRate.toFixed(2),
            metrics: {
                likes,
                comments,
                likesVsAvg: likesVsAvg.toFixed(2),
                commentsVsAvg: commentsVsAvg.toFixed(2)
            }
        };
    });
    
    // Sort by score
    results.postScores.sort((a, b) => b.score - a.score);
    
    // Calculate average
    results.averageScore = Math.round(
        results.postScores.reduce((s, p) => s + p.score, 0) / results.postScores.length
    );
    
    // Identify top and under performers
    results.topPerformers = results.postScores.filter(p => p.score >= 60).slice(0, 5);
    results.underPerformers = results.postScores.filter(p => p.score < 30).slice(0, 5);
    
    // Generate insights
    if (results.topPerformers.length > 0) {
        const topTypes = results.topPerformers.map(p => p.post.postType);
        const mostCommonType = this._getMostCommon(topTypes);
        results.insights.push(`🏆 Top performing content is primarily ${mostCommonType}s`);
    }
    
    if (results.underPerformers.length > results.postScores.length * 0.3) {
        results.insights.push('⚠️ Many posts are underperforming - consider content strategy review');
    }
    
    return results;
};

/**
 * Best Time Analysis
 * Analyzes posting times to find optimal posting schedule
 */
P.analyzeBestPostingTimes = function(profile, posts) {
    const results = {
        bestDays: [],
        bestHours: [],
        worstTimes: [],
        recommendations: [],
        heatmap: {}
    };
    
    if (posts.length < 3) return results;
    
    // Group posts by day and hour
    const dayStats = Array(7).fill(null).map(() => ({ count: 0, totalEng: 0 }));
    const hourStats = Array(24).fill(null).map(() => ({ count: 0, totalEng: 0 }));
    
    posts.forEach(post => {
        if (!post.timestamp) return;
        
        const date = new Date(post.timestamp * 1000);
        const day = date.getDay();
        const hour = date.getHours();
        
        const eng = (post.likes || 0) + (post.comments || 0);
        
        dayStats[day].count++;
        dayStats[day].totalEng += eng;
        
        hourStats[hour].count++;
        hourStats[hour].totalEng += eng;
    });
    
    // Calculate averages
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayAvgs = dayStats.map((d, i) => ({
        day: dayNames[i],
        dayIndex: i,
        avgEng: d.count > 0 ? Math.round(d.totalEng / d.count) : 0,
        postCount: d.count
    }));
    
    const hourAvgs = hourStats.map((h, i) => ({
        hour: i,
        hourLabel: `${i}:00`,
        avgEng: h.count > 0 ? Math.round(h.totalEng / h.count) : 0,
        postCount: h.count
    }));
    
    // Sort by average engagement
    results.bestDays = dayAvgs.sort((a, b) => b.avgEng - a.avgEng).filter(d => d.postCount > 0);
    results.bestHours = hourAvgs.sort((a, b) => b.avgEng - a.avgEng).filter(h => h.postCount > 0);
    
    // Find worst times
    results.worstTimes = hourAvgs.filter(h => h.postCount > 0).sort((a, b) => a.avgEng - b.avgEng).slice(0, 3);
    
    // Generate recommendations
    if (results.bestDays.length > 0) {
        results.recommendations.push(`📅 Best day to post: ${results.bestDays[0].day} (avg ${results.bestDays[0].avgEng} engagements)`);
    }
    
    if (results.bestHours.length > 0) {
        const bestHour = results.bestHours[0];
        const nextHour = (bestHour.hour + 1) % 24;
        results.recommendations.push(`⏰ Best posting window: ${bestHour.hourLabel} - ${nextHour}:00`);
    }
    
    if (results.worstTimes.length > 0) {
        results.recommendations.push(`⚠️ Avoid posting at: ${results.worstTimes.map(t => t.hourLabel).join(', ')}`);
    }
    
    return results;
};

/**
 * Hashtag Performance Analysis
 * Analyzes which hashtags drive the most engagement
 */
P.analyzeHashtagPerformance = function(profile, posts) {
    const results = {
        hashtagStats: [],
        topHashtags: [],
        avgHashtagsPerPost: 0,
        hashtagEngRate: 0,
        recommendations: []
    };
    
    const hashtagMap = {};
    let totalHashtags = 0;
    let postsWithHashtags = 0;
    
    posts.forEach(post => {
        const caption = post.caption || '';
        const hashtags = caption.match(/#[\w]+/g) || [];
        
        if (hashtags.length > 0) {
            postsWithHashtags++;
            totalHashtags += hashtags.length;
            
            const eng = (post.likes || 0) + (post.comments || 0);
            
            hashtags.forEach(tag => {
                const tagLower = tag.toLowerCase();
                if (!hashtagMap[tagLower]) {
                    hashtagMap[tagLower] = {
                        tag: tagLower,
                        count: 0,
                        totalEng: 0,
                        posts: []
                    };
                }
                hashtagMap[tagLower].count++;
                hashtagMap[tagLower].totalEng += eng;
                hashtagMap[tagLower].posts.push(post);
            });
        }
    });
    
    // Calculate stats for each hashtag
    results.hashtagStats = Object.values(hashtagMap).map(tag => ({
        ...tag,
        avgEng: tag.count > 0 ? Math.round(tag.totalEng / tag.count) : 0
    }));
    
    // Sort by frequency and engagement
    results.topHashtags = results.hashtagStats
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    
    results.avgHashtagsPerPost = posts.length > 0 ? 
        (totalHashtags / posts.length).toFixed(1) : 0;
    
    // Calculate engagement rate for posts with vs without hashtags
    const postsWith = posts.filter(p => (p.caption || '').includes('#'));
    const postsWithout = posts.filter(p => !(p.caption || '').includes('#'));
    
    const engWith = postsWith.length > 0 ? 
        postsWith.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / postsWith.length : 0;
    const engWithout = postsWithout.length > 0 ?
        postsWithout.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / postsWithout.length : 0;
    
    results.hashtagEngRate = engWithout > 0 ? 
        ((engWith / engWithout - 1) * 100).toFixed(1) : 0;
    
    // Recommendations
    if (parseFloat(results.avgHashtagsPerPost) < 5) {
        results.recommendations.push('🏷️ Use 5-10 hashtags per post for optimal discovery');
    }
    if (parseFloat(results.avgHashtagsPerPost) > 15) {
        results.recommendations.push('⚠️ Too many hashtags may look spammy - aim for 5-10');
    }
    if (postsWithout.length > postsWith.length) {
        results.recommendations.push('📊 Posts with hashtags get more reach - add them consistently');
    }
    
    return results;
};

/**
 * Content Type Comparison
 * Compares performance across different content types
 */
P.analyzeContentTypeComparison = function(profile, posts) {
    const results = {
        typeStats: {},
        bestType: null,
        worstType: null,
        recommendations: []
    };
    
    const typeStats = {};
    
    posts.forEach(post => {
        const type = post.postType || 'unknown';
        if (!typeStats[type]) {
            typeStats[type] = {
                type,
                count: 0,
                totalLikes: 0,
                totalComments: 0,
                totalEng: 0,
                posts: []
            };
        }
        
        const likes = post.likes || 0;
        const comments = post.comments || 0;
        
        typeStats[type].count++;
        typeStats[type].totalLikes += likes;
        typeStats[type].totalComments += comments;
        typeStats[type].totalEng += likes + comments;
        typeStats[type].posts.push(post);
    });
    
    // Calculate averages
    results.typeStats = Object.values(typeStats).map(stat => ({
        ...stat,
        avgLikes: stat.count > 0 ? Math.round(stat.totalLikes / stat.count) : 0,
        avgComments: stat.count > 0 ? Math.round(stat.totalComments / stat.count) : 0,
        avgEng: stat.count > 0 ? Math.round(stat.totalEng / stat.count) : 0,
        percentage: ((stat.count / posts.length) * 100).toFixed(1)
    }));
    
    // Sort by average engagement
    results.typeStats.sort((a, b) => b.avgEng - a.avgEng);
    
    if (results.typeStats.length > 0) {
        results.bestType = results.typeStats[0];
        results.worstType = results.typeStats[results.typeStats.length - 1];
    }
    
    // Recommendations
    if (results.bestType && results.worstType && results.bestType.type !== results.worstType.type) {
        const engDiff = results.bestType.avgEng - results.worstType.avgEng;
        if (engDiff > 50) {
            results.recommendations.push(
                `🎬 ${results.bestType.type}s outperform ${results.worstType.type}s by ${engDiff} avg engagements - create more ${results.bestType.type}s`
            );
        }
    }
    
    const reelStats = results.typeStats.find(t => t.type === 'reel');
    if (reelStats && reelStats.percentage < 30) {
        results.recommendations.push('📱 Reels get 2-3x more reach - increase reel content to 40%+');
    }
    
    return results;
};

/**
 * Engagement Pattern Analysis
 * Analyzes how engagement evolves over time
 */
P.analyzeEngagementPatterns = function(profile, posts) {
    const results = {
        trend: 'stable',
        trendStrength: 0,
        velocity: 0,
        consistency: 0,
        patterns: [],
        recommendations: []
    };
    
    if (posts.length < 4) return results;
    
    // Sort posts by timestamp
    const sortedPosts = [...posts]
        .filter(p => p.timestamp)
        .sort((a, b) => a.timestamp - b.timestamp);
    
    if (sortedPosts.length < 4) return results;
    
    // Calculate engagement for each post
    const engagements = sortedPosts.map(p => (p.likes || 0) + (p.comments || 0));
    
    // Split into halves for trend analysis
    const mid = Math.floor(engagements.length / 2);
    const firstHalf = engagements.slice(0, mid);
    const secondHalf = engagements.slice(mid);
    
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    
    // Calculate velocity
    results.velocity = avgFirst > 0 ? 
        ((avgSecond - avgFirst) / avgFirst * 100).toFixed(1) : 0;
    
    // Determine trend
    if (results.velocity > 15) {
        results.trend = 'growing';
        results.trendStrength = Math.min(100, results.velocity);
    } else if (results.velocity < -15) {
        results.trend = 'declining';
        results.trendStrength = Math.min(100, Math.abs(results.velocity));
    } else {
        results.trend = 'stable';
        results.trendStrength = 100 - Math.abs(results.velocity);
    }
    
    // Calculate consistency (coefficient of variation)
    const mean = engagements.reduce((s, v) => s + v, 0) / engagements.length;
    const variance = engagements.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / engagements.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? (stdDev / mean) : 0;
    
    results.consistency = Math.max(0, Math.min(100, (1 - cv) * 100));
    
    // Identify patterns
    if (results.consistency > 70) {
        results.patterns.push('✅ Consistent engagement across posts');
    } else if (results.consistency < 40) {
        results.patterns.push('⚠️ Highly variable engagement - content quality inconsistent');
    }
    
    // Check for recent uptick/downtick
    const recent3 = engagements.slice(-3);
    const prev3 = engagements.slice(-6, -3);
    if (prev3.length === 3 && recent3.length === 3) {
        const recentAvg = recent3.reduce((s, v) => s + v, 0) / 3;
        const prevAvg = prev3.reduce((s, v) => s + v, 0) / 3;
        
        if (recentAvg > prevAvg * 1.3) {
            results.patterns.push('📈 Recent posts showing strong improvement');
        } else if (recentAvg < prevAvg * 0.7) {
            results.patterns.push('📉 Recent posts underperforming - review content strategy');
        }
    }
    
    // Recommendations
    if (results.trend === 'declining') {
        results.recommendations.push('⚠️ Engagement is declining - try new content formats or posting times');
    }
    if (results.consistency < 50) {
        results.recommendations.push('📊 Inconsistent engagement - focus on replicating top-performing content');
    }
    
    return results;
};

/**
 * Competitor Benchmark Analysis
 * Compares performance against industry benchmarks
 */
P.analyzeCompetitorBenchmark = function(profile, posts) {
    const results = {
        followerTier: '',
        benchmarks: {},
        vsBenchmark: {},
        grade: '',
        recommendations: []
    };
    
    const followers = profile.followers || 0;
    
    // Determine follower tier and benchmarks
    if (followers < 1000) {
        results.followerTier = 'Nano (<1K)';
        results.benchmarks = { er: 5, likesPerPost: 50, commentsPerPost: 5 };
    } else if (followers < 10000) {
        results.followerTier = 'Micro (1K-10K)';
        results.benchmarks = { er: 3.5, likesPerPost: 200, commentsPerPost: 15 };
    } else if (followers < 100000) {
        results.followerTier = 'Mid (10K-100K)';
        results.benchmarks = { er: 2, likesPerPost: 1500, commentsPerPost: 50 };
    } else if (followers < 500000) {
        results.followerTier = 'Macro (100K-500K)';
        results.benchmarks = { er: 1.5, likesPerPost: 8000, commentsPerPost: 200 };
    } else {
        results.followerTier = 'Mega (500K+)';
        results.benchmarks = { er: 1, likesPerPost: 40000, commentsPerPost: 1000 };
    }
    
    // Calculate actual metrics
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    const avgLikes = posts.length > 0 ? totalLikes / posts.length : 0;
    const avgComments = posts.length > 0 ? totalComments / posts.length : 0;
    const engRate = followers > 0 ? ((avgLikes + avgComments) / followers * 100) : 0;
    
    // Compare to benchmarks
    results.vsBenchmark = {
        er: engRate.toFixed(2),
        erBenchmark: results.benchmarks.er,
        erDiff: ((engRate / results.benchmarks.er - 1) * 100).toFixed(1),
        avgLikes: Math.round(avgLikes),
        avgLikesBenchmark: results.benchmarks.likesPerPost,
        avgComments: Math.round(avgComments),
        avgCommentsBenchmark: results.benchmarks.commentsPerPost
    };
    
    // Calculate grade
    const erRatio = engRate / results.benchmarks.er;
    if (erRatio >= 1.5) results.grade = 'A+';
    else if (erRatio >= 1.2) results.grade = 'A';
    else if (erRatio >= 1) results.grade = 'B+';
    else if (erRatio >= 0.8) results.grade = 'B';
    else if (erRatio >= 0.6) results.grade = 'C';
    else results.grade = 'D';
    
    // Recommendations based on comparison
    if (erRatio < 0.8) {
        results.recommendations.push(
            `📊 Your ER (${engRate.toFixed(2)}%) is below the ${results.followerTier} benchmark (${results.benchmarks.er}%)`
        );
    }
    
    if (avgLikes < results.benchmarks.likesPerPost * 0.7) {
        results.recommendations.push('❤️ Likes below average - focus on creating more engaging visual content');
    }
    
    if (avgComments < results.benchmarks.commentsPerPost * 0.7) {
        results.recommendations.push('💬 Comments below average - add more CTAs and questions to captions');
    }
    
    return results;
};

/**
 * Generate Combined Insights from all analyses
 */
P.generateCombinedInsights = function(analysis) {
    const insights = [];
    
    // Content Performance insights
    if (analysis.contentPerformance) {
        const cp = analysis.contentPerformance;
        if (cp.topPerformers.length > 0) {
            insights.push({
                type: 'success',
                icon: '🏆',
                text: `Top ${cp.topPerformers.length} posts average score: ${Math.round(cp.topPerformers.reduce((s, p) => s + p.score, 0) / cp.topPerformers.length)}`
            });
        }
        if (cp.underPerformers.length > cp.totalPosts * 0.3) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                text: `${cp.underPerformers.length} posts need improvement (score < 30)`
            });
        }
    }
    
    // Best Time insights
    if (analysis.bestTimeAnalysis) {
        const bt = analysis.bestTimeAnalysis;
        if (bt.bestDays.length > 0) {
            insights.push({
                type: 'info',
                icon: '📅',
                text: `Best posting day: ${bt.bestDays[0].day}`
            });
        }
        if (bt.bestHours.length > 0) {
            insights.push({
                type: 'info',
                icon: '⏰',
                text: `Optimal posting time: ${bt.bestHours[0].hourLabel}`
            });
        }
    }
    
    // Hashtag insights
    if (analysis.hashtagPerformance) {
        const hp = analysis.hashtagPerformance;
        if (hp.hashtagEngRate > 0) {
            insights.push({
                type: 'success',
                icon: '🏷️',
                text: `Hashtags boost engagement by ${hp.hashtagEngRate}%`
            });
        }
    }
    
    // Content Type insights
    if (analysis.contentTypeComparison) {
        const ct = analysis.contentTypeComparison;
        if (ct.bestType) {
            insights.push({
                type: 'info',
                icon: '📊',
                text: `Best performing type: ${ct.bestType.type} (${ct.bestType.avgEng} avg engagement)`
            });
        }
    }
    
    // Engagement Pattern insights
    if (analysis.engagementPatterns) {
        const ep = analysis.engagementPatterns;
        insights.push({
            type: ep.trend === 'growing' ? 'success' : ep.trend === 'declining' ? 'warning' : 'info',
            icon: ep.trend === 'growing' ? '📈' : ep.trend === 'declining' ? '📉' : '➡️',
            text: `Engagement trend: ${ep.trend} (${ep.velocity}% change)`
        });
    }
    
    // Competitor Benchmark insights
    if (analysis.competitorBenchmark) {
        const cb = analysis.competitorBenchmark;
        insights.push({
            type: cb.grade.startsWith('A') || cb.grade.startsWith('B') ? 'success' : 'warning',
            icon: '🎯',
            text: `Performance grade: ${cb.grade} (${cb.followerTier})`
        });
    }
    
    return insights;
};

/**
 * Generate Smart Recommendations
 */
P.generateSmartRecommendations = function(analysis) {
    const recs = [];
    
    // Collect all recommendations from sub-analyses
    if (analysis.bestTimeAnalysis?.recommendations) {
        recs.push(...analysis.bestTimeAnalysis.recommendations);
    }
    if (analysis.hashtagPerformance?.recommendations) {
        recs.push(...analysis.hashtagPerformance.recommendations);
    }
    if (analysis.contentTypeComparison?.recommendations) {
        recs.push(...analysis.contentTypeComparison.recommendations);
    }
    if (analysis.engagementPatterns?.recommendations) {
        recs.push(...analysis.engagementPatterns.recommendations);
    }
    if (analysis.competitorBenchmark?.recommendations) {
        recs.push(...analysis.competitorBenchmark.recommendations);
    }
    
    // Add priority recommendations based on biggest gaps
    if (analysis.competitorBenchmark) {
        const cb = analysis.competitorBenchmark;
        if (cb.vsBenchmark.erDiff < -20) {
            recs.unshift(`🚨 CRITICAL: Your ER is ${Math.abs(cb.vsBenchmark.erDiff)}% below benchmark - immediate content strategy review needed`);
        }
    }
    
    // Remove duplicates and limit
    const uniqueRecs = [...new Set(recs)];
    return uniqueRecs.slice(0, 10);
};

/**
 * Calculate Overall Score (0-100)
 */
P.calculateOverallScore = function(analysis) {
    // Dynamically reweight based on which analyses actually succeeded
    const factors = [];
    
    // Content Performance (weight: 25)
    if (analysis.contentPerformance) {
        factors.push({ score: analysis.contentPerformance.averageScore, weight: 25 });
    }
    
    // Engagement Patterns (weight: 25)
    if (analysis.engagementPatterns) {
        factors.push({ score: analysis.engagementPatterns.consistency, weight: 25 });
    }
    
    // Competitor Benchmark (weight: 25)
    if (analysis.competitorBenchmark) {
        const gradeScores = { 'A+': 100, 'A': 90, 'B+': 80, 'B': 70, 'C': 50, 'D': 30 };
        factors.push({ score: gradeScores[analysis.competitorBenchmark.grade] || 50, weight: 25 });
    }
    
    // Hashtag Performance (weight: 15)
    if (analysis.hashtagPerformance) {
        const hp = analysis.hashtagPerformance;
        factors.push({ score: Math.min(100, parseFloat(hp.avgHashtagsPerPost) * 10 + 50), weight: 15 });
    }
    
    // Content Type Balance (weight: 10)
    if (analysis.contentTypeComparison) {
        const ct = analysis.contentTypeComparison;
        factors.push({ score: Math.min(100, ct.typeStats.length * 25), weight: 10 });
    }
    
    if (factors.length === 0) return 50; // Default score if no data
    
    // Recalculate weights to sum to 100%
    const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
    const weightedScore = factors.reduce((s, f) => s + (f.score * f.weight / totalWeight), 0);
    
    return Math.round(weightedScore);
};

/**
 * Render comprehensive post analysis to UI
 */
P.renderPostAnalysis = function(profile, posts, containerId) {
    const analysis = this.analyzePostsComprehensive(profile, posts);
    if (!analysis) return;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this._buildPostAnalysisHTML(analysis);
    
    // Render charts if available
    // Charts can be rendered here if needed in the future
};

/**
 * Build HTML for post analysis display
 */
P._buildPostAnalysisHTML = function(analysis) {
    return `
        <div class="post-analysis-container">
            <!-- Overall Score -->
            <div class="analysis-score-card">
                <div class="score-circle" style="--score: ${analysis.score}">
                    <span class="score-value">${analysis.score}</span>
                    <span class="score-label">Overall Score</span>
                </div>
            </div>
            
            <!-- Key Insights -->
            <div class="analysis-section">
                <h3>💡 Key Insights</h3>
                <div class="insights-grid">
                    ${analysis.insights.map(insight => `
                        <div class="insight-card insight-${insight.type}">
                            <span class="insight-icon">${insight.icon}</span>
                            <span class="insight-text">${insight.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Best Times -->
            ${analysis.bestTimeAnalysis.bestDays.length > 0 ? `
            <div class="analysis-section">
                <h3>📅 Best Posting Times</h3>
                <div class="best-times-grid">
                    <div class="best-time-card">
                        <div class="best-time-label">Best Day</div>
                        <div class="best-time-value">${analysis.bestTimeAnalysis.bestDays[0].day}</div>
                        <div class="best-time-sub">${analysis.bestTimeAnalysis.bestDays[0].avgEng} avg engagement</div>
                    </div>
                    <div class="best-time-card">
                        <div class="best-time-label">Best Hour</div>
                        <div class="best-time-value">${analysis.bestTimeAnalysis.bestHours[0]?.hourLabel || 'N/A'}</div>
                        <div class="best-time-sub">${analysis.bestTimeAnalysis.bestHours[0]?.avgEng || 0} avg engagement</div>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <!-- Content Type Performance -->
            ${analysis.contentTypeComparison.typeStats.length > 0 ? `
            <div class="analysis-section">
                <h3>📊 Content Type Performance</h3>
                <div class="content-type-grid">
                    ${analysis.contentTypeComparison.typeStats.map(type => `
                        <div class="content-type-card">
                            <div class="type-icon">${this._getTypeIcon(type.type)}</div>
                            <div class="type-name">${type.type}</div>
                            <div class="type-stat">${type.count} posts (${type.percentage}%)</div>
                            <div class="type-eng">${type.avgEng} avg engagement</div>
                            <div class="type-bar" style="width: ${Math.min(100, type.avgEng / (analysis.contentTypeComparison.bestType?.avgEng || 1) * 100)}%"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- Hashtag Analysis -->
            ${analysis.hashtagPerformance.topHashtags.length > 0 ? `
            <div class="analysis-section">
                <h3>🏷️ Top Hashtags</h3>
                <div class="hashtag-cloud">
                    ${analysis.hashtagPerformance.topHashtags.slice(0, 10).map(tag => `
                        <span class="hashtag-tag">${tag.tag} <span class="hashtag-count">${tag.count}</span></span>
                    `).join('')}
                </div>
                <div class="hashtag-stats">
                    <span>Avg ${analysis.hashtagPerformance.avgHashtagsPerPost} hashtags/post</span>
                    <span>Hashtag boost: ${analysis.hashtagPerformance.hashtagEngRate}%</span>
                </div>
            </div>
            ` : ''}
            
            <!-- Competitor Benchmark -->
            <div class="analysis-section">
                <h3>🎯 Benchmark Comparison</h3>
                <div class="benchmark-card">
                    <div class="benchmark-tier">${analysis.competitorBenchmark.followerTier}</div>
                    <div class="benchmark-grade grade-${analysis.competitorBenchmark.grade.replace('+', 'plus')}">${analysis.competitorBenchmark.grade}</div>
                    <div class="benchmark-metrics">
                        <div class="benchmark-metric">
                            <span class="bm-label">Your ER</span>
                            <span class="bm-value">${analysis.competitorBenchmark.vsBenchmark.er}%</span>
                        </div>
                        <div class="benchmark-metric">
                            <span class="bm-label">Benchmark</span>
                            <span class="bm-value">${analysis.competitorBenchmark.vsBenchmark.erBenchmark}%</span>
                        </div>
                        <div class="benchmark-metric">
                            <span class="bm-label">Difference</span>
                            <span class="bm-value ${parseFloat(analysis.competitorBenchmark.vsBenchmark.erDiff) >= 0 ? 'positive' : 'negative'}">${analysis.competitorBenchmark.vsBenchmark.erDiff}%</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recommendations -->
            <div class="analysis-section">
                <h3>📋 Smart Recommendations</h3>
                <div class="recommendations-list">
                    ${analysis.recommendations.map((rec, i) => `
                        <div class="recommendation-item" style="--delay: ${i * 0.1}s">
                            <span class="rec-number">${i + 1}</span>
                            <span class="rec-text">${rec}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Top Performers -->
            ${analysis.contentPerformance.topPerformers.length > 0 ? `
            <div class="analysis-section">
                <h3>🏆 Top Performing Posts</h3>
                <div class="top-posts-grid">
                    ${analysis.contentPerformance.topPerformers.slice(0, 3).map((p, i) => `
                        <div class="top-post-card">
                            <div class="top-post-rank">#${i + 1}</div>
                            <div class="top-post-score">${p.score}</div>
                            <div class="top-post-type">${p.post.postType || 'photo'}</div>
                            <div class="top-post-eng">
                                ❤️ ${p.post.likes || 0} · 💬 ${p.post.comments || 0}
                            </div>
                            <div class="top-post-caption">${(p.post.caption || '').substring(0, 60)}${(p.post.caption || '').length > 60 ? '...' : ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- Growth Trajectory -->
            ${analysis.growthTrajectory && analysis.growthTrajectory.timeSpanDays > 0 ? `
            <div class="analysis-section">
                <h3>📈 Growth Trajectory</h3>
                <div class="growth-grid">
                    <div class="growth-card">
                        <div class="growth-label">Posts/Week</div>
                        <div class="growth-value">${analysis.growthTrajectory.postsPerWeek}</div>
                    </div>
                    <div class="growth-card">
                        <div class="growth-label">Time Span</div>
                        <div class="growth-value">${analysis.growthTrajectory.timeSpanDays} days</div>
                    </div>
                    <div class="growth-card">
                        <div class="growth-label">Engagement Trend</div>
                        <div class="growth-value ${analysis.growthTrajectory.engagementVelocity > 0 ? 'positive' : 'negative'}">${analysis.growthTrajectory.engagementVelocity > 0 ? '+' : ''}${analysis.growthTrajectory.engagementVelocity}%</div>
                    </div>
                </div>
                ${analysis.growthTrajectory.insights.length > 0 ? `<div class="insights-list">${analysis.growthTrajectory.insights.map(i => `<div class="insight-item">${i}</div>`).join('')}</div>` : ''}
            </div>
            ` : ''}
            
            <!-- Content Consistency -->
            ${analysis.contentConsistency ? `
            <div class="analysis-section">
                <h3>📊 Content Consistency</h3>
                <div class="consistency-card">
                    <div class="consistency-score">
                        <span class="score-circle-small">${analysis.contentConsistency.consistencyScore}</span>
                        <span class="score-label">Consistency Score</span>
                    </div>
                    <div class="consistency-detail">
                        Engagement consistency: ${analysis.contentConsistency.engagementConsistency.toFixed(0)}%
                    </div>
                </div>
                ${analysis.contentConsistency.insights.length > 0 ? `<div class="insights-list">${analysis.contentConsistency.insights.map(i => `<div class="insight-item">${i}</div>`).join('')}</div>` : ''}
            </div>
            ` : ''}
            
            <!-- Viral Potential -->
            ${analysis.viralPotential && analysis.viralPotential.viralPosts.length > 0 ? `
            <div class="analysis-section">
                <h3>🚀 Viral Potential</h3>
                <div class="viral-card">
                    <div class="viral-score">
                        <span class="score-circle-small">${analysis.viralPotential.viralScore}</span>
                        <span class="score-label">Viral Score</span>
                    </div>
                    <div class="viral-formats">
                        ${analysis.viralPotential.topViralFormats.map(f => `<span class="format-tag">${f.type} (${f.count})</span>`).join('')}
                    </div>
                </div>
                ${analysis.viralPotential.insights.length > 0 ? `<div class="insights-list">${analysis.viralPotential.insights.map(i => `<div class="insight-item">${i}</div>`).join('')}</div>` : ''}
            </div>
            ` : ''}
        </div>
    `;
};

/**
 * Helper: Get icon for content type
 */
P._getTypeIcon = function(type) {
    const icons = {
        'reel': '🎬',
        'video': '🎥',
        'carousel': '📸',
        'photo': '🖼️'
    };
    return icons[type] || '📱';
};

/**
 * Helper: Get most common item in array
 */
P._getMostCommon = function(arr) {
    const counts = {};
    arr.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
};



})();
