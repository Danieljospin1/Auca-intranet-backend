const express=require('express');
const router=express.Router();
const connectionPromise=require('../../../../database & models/databaseConnection');
const {Authenticate}=require('../../../../Authentication/authentication');
const multer=require('multer');
const express = require('express');

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
    const {claimIds}=req.body;
    if(!claimIds || !Array.isArray(claimIds) || claimIds.length === 0){
        return res.status(400).json({message:'claimIds is required and should be a non-empty array'});
    }
    try{
        await connectionPromise.query(`update claims set ClaimStatus='reviewed' where ClaimId IN (${claimIds.map(() => '?').join(',')})`, claimIds);
        return res.status(200).json({message:'Claims reviewed successfully'});
    } catch (error) {
        return res.status(500).json({ message: 'Error reviewing claims' });
    }
});

//creating get route for aucasa minister of communication to get all claims of a particular ClaimCategory,number of ClaimSupports for each claim and also the details of each claim including student names,profile image and id
router.get('/categories/:claimCategory',Authenticate,async(req,res)=>{
    const {claimCategory}=req.params;
    if(!claimCategory){
        return res.status(400).json({message:'claimCategory is required'});
    }
    try{
        const [claims]=await connectionPromise.query(`select c.ClaimId, c.PostId, c.StudentId,s.Lname,s.ProfileUrl, c.ClaimText, c.ClaimEvidenceUrl, c.ClaimVisibility, c.ClaimStatus,c.DateCreated, (select count(*) from claim_supports where ClaimId=c.ClaimId) as NumberOfSupports from claims c join students s on c.StudentId=s.StudentId where c.ClaimCategory=?`,[claimCategory]);
        return res.status(200).json({ claims });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching claims' });
    }
});

module.exports=router;

