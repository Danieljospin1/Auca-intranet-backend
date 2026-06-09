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
    const {PostId,ClaimText,ClaimCategoryId,NewClaimCategoryText,ClaimVisibility}=req.body;  //claim category can be either existing category id or new category text, if the student want to create a new category they will provide the new category text and leave the category id empty, if they want to use existing category they will provide the category id and leave the new category text empty.
    const userId=req.user.Id;
    let ClaimEvidenceImageFile=null;
    if(!PostId || typeof(PostId) !== 'number' || !ClaimText || (!ClaimCategoryId && !NewClaimCategoryText) || !ClaimVisibility || (ClaimVisibility !== 'public' && ClaimVisibility !== 'private')){
        return res.status(400).json({message:'PostId, ClaimText, Category and ClaimVisibility are required'});
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
        if(ClaimCategoryId){
            await connectionPromise.query(`insert into claims (PostId,StudentId, ClaimText,CategoryId, ClaimEvidenceUrl,VisibilityStatus) values (?,?,?,?,?,?)`,
            [PostId, userId, ClaimText, ClaimCategoryId, ClaimEvidenceImageFile, ClaimVisibility]);
            console.log("claim submitted successfully")
        return res.status(201).json({message:'Claim submitted successfully'});
        }
        if(NewClaimCategoryText && !ClaimCategoryId){
            //check if the new categoryName have number of text more than 100 characters
            if(NewClaimCategoryText.length > 100){
                return res.status(400).json({message:'New category name should be less than 100 characters'});
            }
            //insert the new category to the database and get the new category id
            const [newCategoryResult]=await connectionPromise.query(`insert into claimCategory (postId,CreatedById,CategoryName) values (?,?,?)`,[PostId, userId, NewClaimCategoryText]);
            const newCategoryId = newCategoryResult.insertId;
            //insert the claim with the new category id
            await connectionPromise.query(`insert into claims (PostId,StudentId, ClaimText,CategoryId, ClaimEvidenceUrl,VisibilityStatus) values (?,?,?,?,?,?)`,
            [PostId, userId, ClaimText, newCategoryId, ClaimEvidenceImageFile, ClaimVisibility]);
            console.log("claim submitted successfully")
        return res.status(201).json({message:'Claim submitted successfully'});
        }
        else{
            return res.status(400).json({message:'Invalid claim category data'});
        }
    } catch (error) {
        return res.status(500).json({message:'Error submitting claim', error: error.message});
    }
    
});

//creating get claim route that will be used by students to get claimCategories ids,category names and number of claims under each category of a particular post, this will help students to decide which category to choose when submitting a claim, and also to know how many claims are there under each category for a particular post

router.get('/categories',Authenticate,async(req,res)=>{
    const PostId = Number(req.query.PostId);
    if(!PostId || isNaN(PostId)){
        return res.status(400).json({message:'PostId is required or its not valid'});
    }
    try{
        const [claimCategories]=await connectionPromise.query(`select CategoryId, CategoryName, count(*) as NumberOfClaims from claims join claimCategory on claims.CategoryId = claimCategory.CategoryId where claims.PostId=? group by CategoryId, CategoryName`,[PostId]);
        return res.status(200).json(claimCategories);
    
    }catch (error) {
        return res.status(500).json({message:'Error fetching claim categories'});
    }
});

//creating get claims route to get all claims of a particular category id and number of supports for each claim,student names, student ids,this will help students to know which claim is more supported by other students and also to know the details of each claim before supporting it
router.get('/categories/:claimCategoryId',Authenticate,async(req,res)=>{
    const {claimCategoryId}=req.params;
    if(!claimCategoryId){
        return res.status(400).json({message:'ClaimCategoryId is required'});
    }
    try{
        //check if the claimCategoryId is valid and exist in the database
        const [category]=await connectionPromise.query(`select * from claimCategory where CategoryId=?`,[claimCategoryId]);
        if(category.length === 0){
            return res.status(404).json({message:'Claim category not found'});
        }
        const [claims]=await connectionPromise.query(`select claims.*,s.Lname, count(claimSupport.ClaimId) as NumberOfSupports from claims left join claimSupport on claims.ClaimId = claimSupport.ClaimId left join students s on claims.StudentId = s.StudentId where claims.CategoryId=? group by claims.ClaimId`,[claimCategoryId]);
        return res.status(200).json(claims);
    }catch (error) {
        return res.status(500).json({message:`Error fetching claims in category ${claimCategoryId}`});
    }
});

//creating post claim support route that will be used by students to support a claim, this will increase the number of supports for that claim and also add the student id to the list of supporters for that claim, this will help other students to know how many supports a claim has and who are the supporters for that claim
router.post('/newClaimSupport',Authenticate,async(req,res)=>{
    const {ClaimId}=req.body;
    const userId=req.user.Id;
    if(!ClaimId || typeof(ClaimId) !== 'number'){
        return res.status(400).json({message:'ClaimId is required or its not valid'});
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
        console.error('Error checking claim support:', error);
        return res.status(500).json({message:'Error checking claim support'});
    }
});



//creating delete claim route that will be used by students to delete their claim if they want to
router.delete('/deleteClaim/:claimId',Authenticate,async(req,res)=>{
    const {claimId}=req.params;
    //validate 0 claimId and db error code: code: 'ER_NO_REFERENCED_ROW_2'
    if (!claimId || typeof(claimId) !== 'number') {
        return res.status(400).json({message:'ClaimId is required or its not valid'});
    }
    
    try{
        const [claim]=await connectionPromise.query(`select * from claims where ClaimId=? and StudentId=?`,[claimId, req.user.Id]);
        if(claim.length === 0){
            return res.status(404).json({message:'Claim not found or you are not the owner'});
        }
        await connectionPromise.query(`delete from claims where ClaimId=? and StudentId=?`,[claimId, req.user.Id]);
        return res.status(200).json({message:'Claim deleted successfully'});
    } catch (error) {
        return res.status(500).json({message:'Error deleting claim'});
    }
});

module.exports=router;
