const mongoose=require('mongoose');
const OnlineClassSchema= new mongoose.Schema({
    course_id:Number,
    course_name:String,
    course_code:String,
    date:String,
    time:String,
    platform:String

})
module.exports=mongoose.model('onlineClass',OnlineClassSchema);