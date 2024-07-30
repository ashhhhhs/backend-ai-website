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


dotenv.config();

//schema for mongodb
const sectionSchema = new mongoose.Schema({
  template_name: String,
  data: Map,
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

//for connecting in mongodb server
mongoose.connect('mongodb://localhost:27017/dashboardDB')
  .then(() => console.log('MongoDB connected'))
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
fastify.register(require('@fastify/view'), {
  engine: {
    ejs: ejs,
  },
  root: path.join(__dirname, 'views'),
  layout: 'layout.ejs',
    });
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

    if (!company) {
      reply.status(404).send('Not Found');
      return;
    }

    const sectionMap = {
      "header 1": "header/header1.ejs",
      "footer 1": "footer/footer1.ejs",
      
    };

    const data = { ...company.toObject(), url: process.env.BASE_URL + req.url };

    reply.view('layout.ejs', {
      data,
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
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      reply.status(404).send('Not Found');
      return;
    }
    reply.send({ message: 'Company deleted' });
  } catch (err) {
    reply.status(500).send(err);
  }
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
