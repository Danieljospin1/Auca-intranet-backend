const mongoose=require('mongoose');
const notificationSchema= new mongoose.Schema({
    department:String,
    message:String,
    date:String,
    time:String

})
module.exports=mongoose.model('notifications',notificationSchema);