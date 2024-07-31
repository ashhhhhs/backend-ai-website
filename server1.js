const fastify = require('fastify')({ logger: true });
const path = require('path');
const mongoose = require('mongoose');
const fastifyCors = require('@fastify/cors');
const dotenv = require('dotenv');
const ejs = require('ejs');
const fastifyJwt = require('@fastify/jwt');
const fastifyMultipart = require('@fastify/multipart');
const xlsx = require('xlsx');
const { prependListener } = require('process');
const fastifyView = require('@fastify/view');
const { cp } = require('fs');


dotenv.config();

//schema for mongodb
const templateSchema = new mongoose.Schema({
  category: String,
  template_name: String,
});

const sectionSchema = new mongoose.Schema({
  template: templateSchema,
  data: Map,
  order:Number

});


const themeSchema = new mongoose.Schema({
  colors: Map,
  fonts: Map,
});

const companySchema = new mongoose.Schema({
  name: String,
  address: String,
  phone: String,
  logo: String,
  slug: String,
  theme: themeSchema,
  sections: [sectionSchema],
});

const Company = mongoose.model('Company', companySchema);
const Theme = mongoose.model('Theme', themeSchema);
const Section = mongoose.model('Section', sectionSchema);
const Template = mongoose.model('Template', templateSchema);

async function main(){
  // const temp =  await Template.create([{category:'header',template_name:'header1'},{category:'footer',template_name:'footer1'},]);
  // const header = await Template.findById('66aa16dd903f9a624b148647');
  // const footer = await Template.findById('66aa16f9db57a2fbe5446a9e');
  // await Company.create([{name:'XYZ',address:'Baneshwor',phone:"999999",logo:"image.png",slug:"xyz",theme:{colors:{},fonts:{}},sections:[{
  //     template:header,data:{
  //       text:"Footer copyright"
  //     }
  // },{
  //   template:footer,data:{
  //     text:"Footer copyright"
  //   }
  // }]}]);
}
//for connecting in mongodb server
mongoose.connect('mongodb://localhost:27017/dashboardDB')
  .then(() => {console.log('MongoDB connected');main();})
  .catch(err => console.log(err));

//Middleware
fastify.register(fastifyCors, {
  origin: '*',
});


//Authenticating jwt
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET, 
});

//viewing the engine
fastify.register(fastifyView, {
  engine: {
    ejs: require("ejs")
  }
})

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'assets'),
  prefix: '/assets/',
  });

//file uploading
fastify.register(fastifyMultipart);

//Rendering the template
const renderTemplate = async (req, reply) => {
  try {
    const slug = req.params.slug;
    const company = await Company.findOne({ slug });
    const section = Company.sections;
    if (!company) {
      reply.status(404).send('Not Found');
      return;
    }

    const sectionMap = {
      "header 1": "header/header1.ejs",
      "footer 1": "footer/footer1.ejs",
      
    };

    const data = { ...company.toObject(), url: process.env.BASE_URL + req.url };
    // const data1 = { ...template.toObject(), url: process.env.BASE_URL + req.url };

    reply.view('layout.ejs', {
      data,
      // data1,
      sectionMap,
    });
  } catch (err) {
    console.error(`Error: ${err}`);
    reply.status(500).send('Internal Server Error');
  }
};

// Authentication Middleware
fastify.decorate("authenticate", async function (req, reply) {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Routes
fastify.get('/ping', async (req, reply) => {
  reply.send('pong 🏓');
});

fastify.get('/', async (req, reply) => {
  const data = await Company.find();
  reply.status(200).send({ message: data });
});

fastify.get('/:slug/*', async (req, reply) => {
  await renderTemplate(req, reply);
});

// CRUD APIs for Website
fastify.post('/company', { preValidation: [fastify.authenticate] }, async (req, reply) => {
  try {
    const company = new Company(req.body);
    await company.save();
    reply.status(201).send(company);
  } catch (err) {
    reply.status(500).send(err);
  }
});

fastify.get('/company/:id', async (req, reply) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      reply.status(404).send('Not Found');
      return;
    }
    reply.send(company);
  } catch (err) {
    reply.status(500).send(err);
  }
});

// fastify.post('/upload')


// // upaod9jfnecel amfna ==========
// fastify.post('/upload ',
//   {preValidation:[fastify.authenticate], handler: async (req, reply) => {

//     const data = await req.file();
//     const buffer= await buffer.toBuffer();
//     const workbook = xlsx.read(buffer, { type: 'buffer' });
//     const sheetName = workbook.sheetNames[0];
//     const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
//     reply.send (sheetData);

//   }});



fastify.post('/company/upload', { preValidation: [fastify.authenticate], handler: async (req, reply) => {
  const data = await req.file();
  const buffer = await data.toBuffer();
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.sheetNames[0];
  const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  reply.send(sheetData);
}});


// took reference from kshetiz dai and ai
fastify.post('/company/create-template', {
  preValidation: [fastify.authenticate]
}, async (req, reply) => {
  const sheetData = req.session.sheetData;

  if (!sheetData) {
    return reply.status(400).send({ error: 'No uploaded file data found' });
  }

  const template = await createTemplateFromData(sheetData);

  reply.send({ message: 'Template created', template });
});


fastify.put('/company/:id', { preValidation: [fastify.authenticate] }, async (req, reply) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!company) {
      reply.status(404).send('Not Found');
      return;
    }
    reply.send(company);
  } catch (err) {
    reply.status(500).send(err);
  }
});

fastify.delete('/company/:id', { preValidation: [fastify.authenticate] }, async (req, reply) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);;
    if (!company) {
      reply.status(404).send('Not Found');
      return;
    }
    reply.send({ message: 'Company deleted' });
  } catch (err) {
    reply.status(500).send(err);
  }
});
fastify.get('/render/:id',async (req,reply)=>{
  const company = await Company.findOne({slug:req.params.id}).lean();
  const data = {
    sections: company.sections.map(e => ({
      ...e,
      temp_location: e.template.category + '/' + e.template.template_name,
      // Optionally add other properties here
    })),
    company: company // Your data to pass to the template
  };
  return reply.viewAsync('views/render.ejs',data);
  // reply.send(data.sections)
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info(`server listening on 'http://localhost:${fastify.server.address().port}'`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
