const fastify = require('fastify')({ logger: true });
const path = require('path');
const mongoose = require('mongoose');
const fastifyCors = require('@fastify/cors');
const dotenv = require('dotenv');
const ejs = require('ejs');
dotenv.config();
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

mongoose.connect('mongodb://localhost:27017/dashboardDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Middleware
fastify.register(fastifyCors, {
  origin: '*',
});

// Set view engine
fastify.register(require('@fastify/view'), {
  engine: {
    ejs: ejs,
  },
  root: path.join(__dirname, 'views'),
  layout: 'layout.ejs',
});

// Serve static files
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'assets'),
  prefix: '/assets/',
});

const renderTemplate = async (req, reply) => {
  try {
    const splitUrl = req.url.split('/');
    const slug = splitUrl[2];
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

const start = async () => {
  fastify.get('/ping', async (req, reply) => {
    reply.send('pong 🏓');
  });

  fastify.get('/', async (req, reply) => {
    reply.status(200).send({ data: console.log(Company.find()) });
    
  });

  fastify.get('/:key/:slug/*', async (req, reply) => {
    await renderTemplate(req, reply);
  });

  try {
    await fastify.listen({ port: 3000 });
    fastify.log.info(`server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
