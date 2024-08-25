const mongoose =require('mongoose');
const express=require('express')
const postSchema= new mongoose.Schema({
    PostAuthorId:String,
    PostDescription:String,
    PostImage:String,
    PostVideo:String,
    PostDate:String,
    PostTime:String,
    PostCategory:String,
    PostLikes:Number,
    PostComments:Number,
    PostViews:Number,
    

})
module.exports=mongoose.model('postSchema',postSchema);