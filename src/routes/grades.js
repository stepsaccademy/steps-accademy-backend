const router=require('express').Router();const Grade=require('../models/Grade');const User=require('../models/User');const auth=require('../middleware/auth');const {roles}=auth;
router.post('/',auth,roles('admin'),async(req,res)=>{const d=new Date(req.body.date||Date.now());const g=await Grade.create({...req.body,createdBy:req.user._id,week:Math.ceil(d.getDate()/7),month:d.getMonth()+1,year:d.getFullYear()});res.status(201).json({message:'Grades created successful',grade:g})});
router.get('/student/:id',auth,async(req,res)=>{if(req.user.role==='student'&&String(req.user._id)!==String(req.params.id))return res.status(403).json({message:'Forbidden'});const grades=await Grade.find({student:req.params.id}).sort('-date').limit(1000);res.json({grades})});
module.exports=router;
