const express=require('express');
const router=express.Router();
const {Authenticate}=require('../../../Authentication/authentication')
const connectionPromise=require('../../../database & models/databaseConnection')


router.get('/',Authenticate,async(req,res)=>{
   const studentId=req.user.Id
   try{
      const [marks]=await connectionPromise.query(`select * from registration where StudentId=?`,[studentId])
      res.status(200).json(marks);

   }
   catch{(err)=>{
      res.status(500).json({message:err.message})
   }}
})
module.exports=router;