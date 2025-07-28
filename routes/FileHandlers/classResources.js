const express=require('express')
const router=express.Router()
const os=require('os')
const path=require('path')

router.get('/flNmae/:fileName',(req,res)=>{
    const fileName=req.params.fileName
    const desktopFolderPath = path.join(os.homedir(), 'Desktop');
        const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
        const postsFolder=path.join(uploadFolderPath,'classResources')
        const filePath=path.join(postsFolder,fileName)
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(404).send(`<h1>image not found...</h1>`);
            }
        });
})
module.exports=router