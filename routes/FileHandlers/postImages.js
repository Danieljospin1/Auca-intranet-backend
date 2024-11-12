const express=require('express')
const router=express.Router()
const path=require('path')
const os=require('os')
// this is the url to handle post images and files 
router.get('/postImg/:fileName',(req,res)=>{
    const fileName=req.params.fileName
    const desktopFolderPath = path.join(os.homedir(), 'Desktop');
    const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
    const postsFolder=path.join(uploadFolderPath,'posts')
    const filePath=path.join(postsFolder,fileName)
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error sending file:', err);
            res.status(404).send(`<h1>image not found...</h1>`);
        }
    });
})
module.exports=router;