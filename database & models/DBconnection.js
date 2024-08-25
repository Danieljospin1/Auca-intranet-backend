const mongoose =require('mongoose');
 const connectionString='mongodb+srv://Jospin:bisubizo@aucaintranet.5xio5.mongodb.net/?retryWrites=true&w=majority&appName=AucaIntranet';
 function ConnectDB(){
    mongoose.connect(connectionString).then(()=>{
        console.log('Connected to MongoDB');
    }).catch((err)=>{
        console.log(err);
    });
 }
 module.exports=ConnectDB;
 