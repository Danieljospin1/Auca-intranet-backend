const express=require('express');
const router=express.Router();
const connectionPromise=require('../../../database & models/databaseConnection');
const {Authenticate}=require('../../../Authentication/authentication');
const multer=require('multer');
const uploadImage=require("../../../fileHandler/uploadFile");
const upload = require("../../../fileHandler/upload");


//creating post claim that will be used by students to submit a claim from a particular post, claim submittion include this but some are not a must:
//1-PostId (a must)
//2-ClaimText (a must)
//3-ClaimCategory (a must)
//4-ClaimEvidenceImageFile (not a must)
//5-ClaimVisibility(a must) (public or private)
router.post('/',upload.single('ClaimEvidenceImageFile'),Authenticate,async(req,res)=>{
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