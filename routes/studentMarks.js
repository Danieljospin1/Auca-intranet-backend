const express=require('express');
const router=express.Router();
const mongoose=require('mongoose')
const courses=require('../database & models/CoursesModel')

router.post('/',async(req,res)=>{
   const NewCourse=await courses.create(req.body)
   res.status(201).json(NewCourse);
})
module.exports=router;