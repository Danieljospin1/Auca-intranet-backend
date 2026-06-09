const express=require('express');
const router=express.Router();
const connectionPromise=require('../../../../database & models/databaseConnection');
const {Authenticate}=require('../../../../Authentication/authentication');


//creating a get route for aucasa minister of communication to get total number of posts which are active,total number of claims of those active posts and total number of unreviewed claims of those active posts,
//this route will be used in the dashboard of the minister of communication to show him the overall status of the claims and posts in the system
router.get('/summary',Authenticate,async(req,res)=>{
    try{
        const [activePosts]=await connectionPromise.query(`select count(*) as ActivePosts from posts where status='active'`);
        const [activePostClaims]=await connectionPromise.query(`select count(*) as ActivePostClaims from claims where PostId IN (select PostId from posts where status='active')`);
        const [unreviewedClaims]=await connectionPromise.query(`select count(*) as UnreviewedClaims from claims where ClaimStatus='unreviewed' AND PostId IN (select PostId from posts where status='active')`);
        return res.status(200).json({ activePosts: activePosts[0].ActivePosts, activePostClaims: activePostClaims[0].ActivePostClaims, unreviewedClaims: unreviewedClaims[0].UnreviewedClaims });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching summary data' });
    }
});

//creating put route for aucasa minister of communication to automatically update ClaimStatus of array of claim Ids to reviewed, this route will be used in the dashboard of the minister of communication to review multiple claims at once and also to update the status of those claims to reviewed after reviewing them
router.put('/review',Authenticate,async(req,res)=>{
    const {ClaimIds}=req.body;
    //validate strictly user
    const aucasaUserRole=req.user.aucasaUserRole;
    if(aucasaUserRole !== 'information and communication'){
        return res.status(403).json({message:'Access denied. Only minister of communication can review claims.'});
    }
    if(!ClaimIds || !Array.isArray(ClaimIds) || ClaimIds.length === 0){
        return res.status(400).json({message:'ClaimIds is required and should be a non-empty array'});
    }
    
    
    try{
        await connectionPromise.query(`update claims set ClaimStatus='reviewed' where ClaimId IN (${ClaimIds.map(() => '?').join(',')})`, ClaimIds);
        return res.status(200).json({message:'Claims reviewed successfully'});
    } catch (error) {
        return res.status(500).json({ message: 'Error reviewing claims' });
    }
});

//creating get route for aucasa minister of communication to get all claims of a particular ClaimCategory,number of ClaimSupports for each claim and also the details of each claim including student names,profile image and id
router.get('/categories/:claimCategoryId',Authenticate,async(req,res)=>{
    const {claimCategoryId}=req.params;
    if(!claimCategoryId){
        return res.status(400).json({message:'claimCategoryId is required'});
    }
    try{
        const [claims]=await connectionPromise.query(`select c.ClaimId, c.PostId, c.StudentId,s.Lname,s.ProfileUrl, c.ClaimText, c.ClaimEvidenceUrl, c.VisibilityStatus, c.ClaimStatus,c.DateCreated, (select count(*) from claimSupport where ClaimId=c.ClaimId) as NumberOfSupports from claims c join students s on c.StudentId=s.StudentId where c.CategoryId=?`,[claimCategoryId]);
        return res.status(200).json({ claims });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching claims',error: error.message });
    }
});

// GET /postsWithClaims — fetches all posts that have at least one claim, ordered by claim count desc.
// Used by AUCASADashboard left feed.
router.get('/postsWithClaims', Authenticate, async (req, res) => {
    try {
        const [posts] = await connectionPromise.query(`
            SELECT
                p.Id,
                p.Title,
                p.Description,
                p.Timestamp,
                p.ClaimSummary,
                COUNT(c.ClaimId) AS claimsCount
            FROM posts p
            INNER JOIN claims c ON c.PostId = p.Id
            GROUP BY p.Id, p.Title, p.Description, p.Timestamp, p.ClaimSummary
            ORDER BY claimsCount DESC
        `);
        return res.status(200).json({ posts });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching posts with claims', error: error.message });
    }
});

// GET /post/:postId/claims — fetches all claims for a specific post with student details and support count.
// Used by AUCASADashboard right panel and ClaimDetails page.
router.get('/post/:postId/claims', Authenticate, async (req, res) => {
    const postId = Number(req.params.postId);
    if (!postId || isNaN(postId)) {
        return res.status(400).json({ message: 'postId is required and must be a valid number' });
    }
    try {
        const [claims] = await connectionPromise.query(`
            SELECT
                c.ClaimId,
                c.PostId,
                c.StudentId,
                s.Fname,
                s.Lname,
                s.ProfileUrl,
                c.ClaimText,
                cc.CategoryName,
                c.ClaimEvidenceUrl,
                c.VisibilityStatus,
                c.ClaimStatus,
                c.DateCreated,
                (SELECT COUNT(*) FROM claimSupport cs WHERE cs.ClaimId = c.ClaimId) AS NumberOfSupports
            FROM claims c
            JOIN students s ON c.StudentId = s.StudentId
            JOIN claimCategory cc ON c.CategoryId = cc.CategoryId
            WHERE c.PostId = ?
            ORDER BY c.DateCreated DESC
        `, [postId]);
        return res.status(200).json({ claims });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching claims for post', error: error.message });
    }
});

// PATCH /post/:postId/summary — saves the minister's claim summary text for a post.
// Requires the ClaimSummary column on the posts table (TEXT, nullable).
router.patch('/post/:postId/summary', Authenticate, async (req, res) => {
    const postId = Number(req.params.postId);
    const { ClaimSummary } = req.body;
    const aucasaUserRole = req.user.aucasaUserRole;
    if (aucasaUserRole !== 'information and communication') {
        return res.status(403).json({ message: 'Access denied. Only minister of communication can save summaries.' });
    }
    if (!postId || isNaN(postId)) {
        return res.status(400).json({ message: 'postId is required and must be a valid number' });
    }
    if (ClaimSummary === undefined || ClaimSummary === null) {
        return res.status(400).json({ message: 'ClaimSummary text is required' });
    }
    try {
        await connectionPromise.query(`UPDATE posts SET ClaimSummary = ? WHERE Id = ?`, [ClaimSummary, postId]);
        return res.status(200).json({ message: 'Summary saved successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Error saving summary', error: error.message });
    }
});

module.exports=router;
