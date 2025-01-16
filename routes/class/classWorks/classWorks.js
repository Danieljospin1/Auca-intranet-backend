const express=require('express')
const router=express.Router()
const {Authenticate}=require('../../../Authentication/authentication')
const connectionPromise=require('../../../database & models/databaseConnection')
const path=require('path')
const os=require('os')
const multer=require('multer')


//route for lecturers to post classworks

// storing images on server desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const classWorksFolderLocation = path.join(uploadFolderPath, 'classWorks')

// defining classwork files storage

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, classWorksFolderLocation)
    },
    filename: function (req, file, cb) {
        const fileName = file.originalname
        cb(null, fileName)
    }
})
const upload = multer({ storage: storage });

router.post('/',upload.single('classWorkFile'),Authenticate,async(req,res)=>{
    const LecturerId=req.user.Id
    const {ClassId,Description,DeadLine}=req.body
    const ClassWorkFile=req.file
    const userRole=req.user.role
    
    if(userRole=='staff'){
        if(ClassWorkFile){
            const classWorkFileUrl=`http://localhost:3000/class/classWorks/flName/${ClassWorkFile.originalname}`
            try{
                await connectionPromise.query('insert into classWorks(ClassId,LecturerId,Description,AttachmentUrl,Deadline) values(?,?,?,?,?)',[ClassId,LecturerId,Description,classWorkFileUrl,DeadLine])
                res.status(201).json({message:'Classwork posted successfully',classWorkFileUrl})
            }
            catch(error){
                res.status(500).json({message:'Error posting classwork',error})
            }
        }
        else{
            try{
                await connectionPromise.query('insert into classWorks(ClassId,LecturerId,Description,Deadline) values(?,?,?,?,?)',[ClassId,LecturerId,Description,DeadLine])
                res.status(201).json({message:'Classwork posted successfully'})
            }
            catch(error){
                res.status(500).json({message:'Error posting classwork',error})
            }
        }
    }
else{
    res.status(403).json({message:'You are not authorized to post classwork'})
}})
    
    

router.get('/',Authenticate,async(req,res)=>{
    const userId=req.user.Id
    const userRole=req.user.role
    if(userRole==='student'){
        try{
            const [studentClasses]=await connectionPromise.query('select ClassId from roommembership where MemberId=?',[userId])
            const studentClassIds=studentClasses.map(classId=>classId.ClassId)
            const [classWorks]=await connectionPromise.query(`select * from classWorks where ClassId IN (${studentClassIds})`)
            res.status(200).json(classWorks)
        }
        catch(error){
            res.status(500).json({message:'Error fetching classworks',error})
        }
    }
    else{
        try{
            const [classWorks]=await connectionPromise.query('select * from classWorks where LecturerId=?',[userId])
            res.status(200).json(classWorks)
        }
        catch(error){
            res.status(500).json({message:'Error fetching classworks',error})
        }
    }
})

router.delete('/',Authenticate,async(req,res)=>{
    const userId=req.user.Id
    const userRole=req.user.role
    const classWorkId=req.body.classWorkId
    if(userRole==='staff'){
        try{
           const [classWorkCheck]=await connectionPromise.query('select * from classworks where Id=? and LecturerId=?',[classWorkId,userId])
           if(classWorkCheck.length===0){
            res.status(404).json({message:'Classwork not found'})
           }
           else{
            try{
                await connectionPromise.query('delete from classworks where Id=?',[classWorkId])
                res.status(200).json({message:'Classwork deleted successfully'})
            }
            catch(error){
                res.status(500).json({message:'Error deleting classwork',error})
            }
           }
        }
        catch(error){
            res.status(500).json({message:'Error checking classwork',error})
        }
    }
    else{
        res.status(403).json({message:'Forbidden',error:'You are not authorized to delete classwork'})
    }

})
module.exports=router;