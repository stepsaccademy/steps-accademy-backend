const mongoose=require('mongoose');
const userSchema=new mongoose.Schema({role:{type:String,enum:['student','teacher','admin'],required:true},name:String,username:{type:String,required:true,unique:true,trim:true,index:true},email:String,phone:String,passwordHash:{type:String,required:true},studentId:{type:String,index:true,sparse:true},teacherId:{type:String,index:true,sparse:true},subjects:[String],className:String,bio:String,avatar:String,active:{type:Boolean,default:true}},{timestamps:true});
module.exports=mongoose.model('User',userSchema);
