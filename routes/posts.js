const postSchema=require('../database & models/PostModel.js');
const express=require('express');
const router = express.Router();


router.post('/',async(req,res)=>{
    const newPost=await postSchema.create(req.body);
    res.status(201).json({newPost})
    console.log(newPost)
})
router.get('/',async(req,res)=>{
    try{
        const posts=await postSchema.find({})
        res.status(200).json({posts})
    }
    catch{(err)=>{
        res.status(500).json({err});
    }}
})

module.exports=router;