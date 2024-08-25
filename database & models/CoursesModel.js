const mongoose=require('mongoose');
const courseSchema= new mongoose.Schema({
    courseName:String,
    courseCode:String,
    courseMarks:Number
})
module.exports=mongoose.model('Courses',courseSchema);
