const router=require('express').Router();const bcrypt=require('bcryptjs');const User=require('../models/User');const Grade=require('../models/Grade');const Content=require('../models/Content');const Fee=require('../models/Fee');const auth=require('../middleware/auth');const {roles}=auth;router.use(auth,roles('admin'));
router.post('/students', async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        message: 'Name, username and password are compulsory'
      });
    }

    const existing = await User.findOne({ username });

    if (existing) {
      return res.status(400).json({
        message: 'Username already exists'
      });
    }

    const data = { ...req.body };

    // Empty optional fields remove karo
    Object.keys(data).forEach((key) => {
      if (data[key] === '') {
        delete data[key];
      }
    });

    const passwordHash = await bcrypt.hash(password, 12);

    const u = await User.create({
      ...data,
      name,
      username,
      role: 'student',
      passwordHash
    });

    const user = u.toObject();
    delete user.passwordHash;

    res.status(201).json({
      message: 'Student created successfully',
      user
    });

  } catch (e) {
    console.error('Create student error:', e);

    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || 'field';

      return res.status(400).json({
        message: `${field} already exists`
      });
    }

    res.status(400).json({
      message: e.message || 'Unable to create student'
    });
  }
});
   router.post('/teachers', async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        message: 'Name, username and password are compulsory'
      });
    }

    const existing = await User.findOne({ username });

    if (existing) {
      return res.status(400).json({
        message: 'Username already exists'
      });
    }

    const data = { ...req.body };

    // Empty optional fields remove karo
    Object.keys(data).forEach((key) => {
      if (data[key] === '') {
        delete data[key];
      }
    });

    const passwordHash = await bcrypt.hash(password, 12);

    const u = await User.create({
      ...data,
      name,
      username,
      role: 'teacher',
      passwordHash
    });

    const user = u.toObject();
    delete user.passwordHash;

    res.status(201).json({
      message: 'Teacher created successfully',
      user
    });

  } catch (e) {
    console.error('Create teacher error:', e);

    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || 'field';

      return res.status(400).json({
        message: `${field} already exists`
      });
    }

    res.status(400).json({
      message: e.message || 'Unable to create teacher'
    });
  }
});
    router.get('/students/search',async(req,res)=>{const q=String(req.query.q||'');const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');const student=await User.findOne({role:'student',$or:[{name:re},{username:re},{studentId:re}]}).select('-passwordHash');res.json({student})});
router.get('/stats',async(req,res)=>res.json({totalStudents:await User.countDocuments({role:'student'}),totalTeachers:await User.countDocuments({role:'teacher'}),announcements:await Content.countDocuments({type:'announcement',status:'approved'}),pending:await Content.countDocuments({status:'pending'})}));
router.get('/users',async(req,res)=>{const role=req.query.role;const users=await User.find(role?{role}:{}).select('-passwordHash').limit(500);res.json({users})});
router.post('/approve/:id',async(req,res)=>{const c=await Content.findByIdAndUpdate(req.params.id,{status:'approved'},{new:true});res.json({message:'Approved',content:c})});
router.delete('/content/:id',async(req,res)=>{await Content.findByIdAndDelete(req.params.id);res.json({message:'Deleted'})});
router.patch('/users/:id',async(req,res)=>{const allowed=['name','username','email','phone','subjects','className','bio'];const data={};allowed.forEach(k=>{if(req.body[k]!==undefined)data[k]=req.body[k]});const u=await User.findByIdAndUpdate(req.params.id,data,{new:true}).select('-passwordHash');res.json({message:'Updated',user:u})});
router.delete('/users/:id',async(req,res)=>{await User.findByIdAndDelete(req.params.id);res.json({message:'Deleted'})});
router.post('/fees',async(req,res)=>{const f=await Fee.findOneAndUpdate({student:req.body.student},{...req.body,$push:{history:{amount:req.body.paid,status:req.body.status,date:new Date()}}},{upsert:true,new:true});res.json({message:'Fees updated',fee:f})});
module.exports=router;
