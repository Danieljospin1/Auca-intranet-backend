const express=require('express');
const router=express.Router();
const connectionPromise=require('../../../../database & models/databaseConnection');
const {Authenticate}=require('../../../../Authentication/authentication');
const multer=require('multer');
const uploadImage=require("../../../../fileHandler/uploadFile");
const upload = require("../../../../fileHandler/upload");


//creating post claim that will be used by students to submit a claim from a particular post, claim submittion include this but some are not a must:
//1-PostId (a must)
//2-ClaimText (a must)
//3-ClaimCategory (a must)
//4-ClaimEvidenceImageFile (not a must)
//5-ClaimVisibility(a must) (public or private)
router.post('/newClaim',upload.single('ClaimEvidenceImageFile'),Authenticate,async(req,res)=>{
    const {PostId,ClaimText,ClaimCategory,ClaimVisibility}=req.body;
    const userId=req.user.Id;
    let ClaimEvidenceImageFile=null;
    if(!PostId || !ClaimText || !ClaimCategory || !ClaimVisibility){
        return res.status(400).json({message:'PostId, ClaimText, ClaimCategory and ClaimVisibility are required'});
    }
    if(req.file){
        try{
            const { originalUrl }=await uploadImage(req.file.buffer, "claims", req.file.mimetype, req.file.originalname);
            ClaimEvidenceImageFile=originalUrl;
        } catch (error) {
            return res.status(500).json({message:'Error uploading image'});
        }
    }
    try{
        await connectionPromise.query(`insert into claims (PostId,StudentId, ClaimText, ClaimCategory, ClaimEvidenceUrl, ClaimVisibility) values (?,?,?,?,?,?)`,
            [PostId, userId, ClaimText, ClaimCategory, ClaimEvidenceImageFile, ClaimVisibility]);
        return res.status(201).json({message:'Claim submitted successfully'});
    } catch (error) {
        return res.status(500).json({message:'Error submitting claim'});
    }
    
});

//creating get claim route that will be used by students to get claimCategories and number of claims under each category of a particular post, this will help students to decide which category to choose when submitting a claim, and also to know how many claims are there under each category for a particular post

router.get('/categories',Authenticate,async(req,res)=>{
    const {PostId}=req.query;
    if(!PostId){
        return res.status(400).json({message:'PostId is required'});
    }
    try{
        const [claimCategories]=await connectionPromise.query(`select ClaimCategory, count(*) as NumberOfClaims from claims where PostId=? group by ClaimCategory`,[PostId]);
        return res.status(200).json(claimCategories);
    
    }catch (error) {
        return res.status(500).json({message:'Error fetching claim categories'});
    }
});

//creating get claims route to get all claims of a particular category name and number of supports for each claim, this will help students to know which claim is more supported by other students and also to know the details of each claim before supporting it
router.get('/categories/:claimCategory',Authenticate,async(req,res)=>{
    const {claimCategory}=req.params;
    if(!claimCategory){
        return res.status(400).json({message:'ClaimCategory is required'});
    }
    try{
        const [claims]=await connectionPromise.query(`select claims.*, count(claimSupport.ClaimId) as NumberOfSupports from claims left join claimSupport on claims.ClaimId = claimSupport.ClaimId where claims.ClaimCategory=? group by claims.ClaimId`,[claimCategory]);
        return res.status(200).json(claims);
    }catch (error) {
        return res.status(500).json({message:`Error fetching claims in category ${claimCategory}`});
    }
});

//creating post claim support route that will be used by students to support a claim, this will increase the number of supports for that claim and also add the student id to the list of supporters for that claim, this will help other students to know how many supports a claim has and who are the supporters for that claim
router.post('/newClaimSupport',Authenticate,async(req,res)=>{
    const {ClaimId}=req.body;
    const userId=req.user.Id;
    if(!ClaimId){
        return res.status(400).json({message:'ClaimId is required'});
    }
    try{
        // Check if the student has already supported the claim
        const [existingSupport]=await connectionPromise.query(`select * from claimSupport where ClaimId=? and StudentId=?`,[ClaimId, userId]);
        if(existingSupport.length > 0){
            await connectionPromise.query(`delete from claimSupport where ClaimId=? and StudentId=?`,[ClaimId, userId]);
            return res.status(200).json({message:'Claim support removed successfully'});
        }
        // Insert support record
        await connectionPromise.query(`insert into claimSupport (ClaimId, StudentId) values (?,?)`,[ClaimId, userId]);
        return res.status(200).json({message:'Claim supported successfully'});
    } catch (error) {
        return res.status(500).json({message:'Error checking claim support'});
    }
});



//creating delete claim route that will be used by students to delete their claim if they want to
router.delete('/deleteClaim/:claimId',Authenticate,async(req,res)=>{
    const {claimId}=req.params;
    try{
        await connectionPromise.query(`delete from claims where ClaimId=? and StudentId=?`,[claimId, req.user.Id]);
        return res.status(200).json({message:'Claim deleted successfully'});
    } catch (error) {
        return res.status(500).json({message:'Error deleting claim'});
    }
});

module.exports=router;
