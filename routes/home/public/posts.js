const express=require ('express');
const router=express.Router()
const connectionPromise=require('../../../database & models/databaseConnection');
const multer=require('multer')
const path=require('path')
const fs=require('fs')
const os=require('os')
const auth=require('../../../Authentication/authentication')

// storing images on pc desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');

// defining image posts storage

const storage = multer.diskStorage({
    
    destination: function (req, file, cb) {
        cb(null, uploadFolderPath)
    },
    filename: function (req, file, cb) {
        const fileName=Date.now() + path.extname(file.originalname)
        cb(null,fileName )
    }
})
const upload = multer({ storage: storage });

router.post('/',upload.single('post'),auth,async(req,res)=>{
    try{
        const file=req.file;
        const filePath=file.path;
        const {description,audience}=req.body;
        const postedById=req.user.studentId;

        // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
        const escapedFilePath = filePath.replace(/\\/g, '\\\\');
        if(!file){
            return res.status(400).json({message:'No file uploaded'})
        }
        else{
            res.status(200).send('post uploaded successfully...')
            console.log(file.filename)

            const uploadImage=await connectionPromise.query(`insert into posts(CreatorId,ImageUrl,Description,Audience) values (${postedById},'${escapedFilePath}','${description}','${audience}')`).then(()=>{
                 res.status(200).json({message:`Post updated successfully...`})
                 
                
                
            })
            
            
        }
    }
    catch{(err)=>{
        console.log(err);
    }}
})


router.get('/',auth,async(req,res)=>{
    try{
        const studentFaculty="IT"
        const id=req.user.studentId
        const posts=await connectionPromise.query(`select * from posts where Audience='${studentFaculty}'`)
        res.json(posts[0])
        
    }
    catch{(err)=>{
        console.log(err);

    }}
})
module.exports=router;