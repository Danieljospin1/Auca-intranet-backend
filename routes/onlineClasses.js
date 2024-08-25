const onlineClassSchema=require('../database & models/onlineClassModel');
const express=require('express');
const mongoose=require('mongoose');
const router= express.Router();

router.post('/',async(req,res)=>{
    try{
        const NewOnlineClass= await onlineClassSchema.create(req.body)
        res.status(201).json({message:"Online Class Created Successfully",data:NewOnlineClass})
    }
    catch(err){
        res.status(500).json({message:"Error Occured",error:err})
    }
})
module.exports=router;