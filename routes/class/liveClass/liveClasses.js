const express=require('express')
const router=express.Router()
const {Authenticate}=require('../../../Authentication/authentication')
const connectionPromise=require('../../../database & models/databaseConnection')

// the route for staff to be able to set live classes for their students

router.post('/',Authenticate,async(req,res)=>{
    const{courseId,classGroupId,topic,platform,link}=req.body;
    const userId=req.user.Id;
    try{
        await connectionPromise.query(
            `INSERT INTO liveclasses (CourseId, ClassGroupId, LecturerId, Topic, Platform, Link) VALUES (?, ?, ?, ?, ?, ?)`,
            [courseId, classGroupId, userId, topic, platform, link]
          );
          res.status(201).json('Live class had been created successfully...');
    }catch{(err)=>{
        res.status(500).json('Error creating live class...')
    }}
})
router.delete('/',Authenticate,async(req,res)=>{
    const{classId}=req.body.liveClassId;
    try{
        await connectionPromise.query(`delete from liveclasses where Id=?`,[classId]);
        res.status(200).json({"response":'Live class had been deleted successfully...'})
    }
    catch{
        res.status(500).json({"error":'Error deleting live class...'})
    }
})
//route to get live classes posted
router.get('/',Authenticate,async(req,res)=>{
    const userId=req.user.Id;
    const userRole=req.user.role;
    try{
        if(userRole=='staff'){
            const liveClasses=await connectionPromise.query(`select * from liveclasses where LecturerId=?`,[userId]);
            res.status(200).json(liveClasses[0]);
        }
        else if(userRole=='student'){
            const courses=await connectionPromise.query(`select CourseGroup from registration where StudentId=?`[userId])
            res.status(200).send(courses[0])
        
        }
    }catch{(err)=>{
        res.status(500).json('Error fetching live classes...')
    }}
})
module.exports=router;