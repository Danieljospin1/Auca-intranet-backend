const express=require('express')
const router=express.Router()
const path=require('path')
const os=require('os')
// this is the url to handle post image thumbnails and files
router.get('/postImg/thbnl/:fileName',(req,res)=>{
    const fileName=req.params.fileName
    const desktopFolderPath = path.join(os.homedir(), 'Desktop');
    const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
    const thumbNailFolderLocation=path.join(uploadFolderPath,'thumbnails')
    
    const filePath=path.join(thumbNailFolderLocation,fileName)
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error sending file:', err);
            res.status(404).send(`<h1>image not found...</h1>`);
        }
    });
    
})
module.exports=router;