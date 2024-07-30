const fastify = require('fastify')({ logger: true });
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const nunjucks = require('nunjucks');
const dotenv = require('dotenv');

dotenv.config();

fastify.register(require('fastify-multipart'));
fastify.register(require('fastify-jwt'), {
  secret: '12345'
});

fastify.decorate('authenticate', async function (req, reply) {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

const routeData = {
  w: {
    collection: "restro1",
    template: "restro",
  },
  x: {
    collection: "restro1",
    template: "restro_old",
  },
  p: {
    collection: "plumber",
    template: "plumbing_old",
  },
  q: {
    collection: "plumber",
    template: "plumbing",
  },
};

nunjucks.configure('views', {
  autoescape: true,
  express: fastify
});

fastify.post('/company/upload', {
  preValidation: [fastify.authenticate],
  handler: async (req, reply) => {
    const data = await req.file();
    const buffer = await data.toBuffer();
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.sheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Store the sheet data in some storage, for example, a database or an in-memory store
    req.session.sheetData = sheetData;

    reply.send(sheetData);
  }
});

async function createTemplateFromData(data) {
  const numEntries = data.length;
  const columns = Object.keys(data[0]);

  let sum = 0;
  let numericalColumn = null;

  for (const col of columns) {
    if (typeof data[0][col] === 'number') {
      numericalColumn = col;
      break;
    }
  }

  if (numericalColumn) {
    sum = data.reduce((acc, row) => acc + (row[numericalColumn] || 0), 0);
  }

  return {
    summary: `Template created with ${numEntries} entries`,
    columns: columns,
    numericalColumn: numericalColumn,
    sum: sum
  };
}

fastify.post('/create-template', {
  preValidation: [fastify.authenticate]
}, async (req, reply) => {
  const sheetData = req.session.sheetData;

  if (!sheetData) {
    return reply.status(400).send({ error: 'No uploaded file data found' });
  }

  const template = await createTemplateFromData(sheetData);

  reply.send({ message: 'Template created', template });
});

async function renderTemplate(req, reply) {
  try {
    const splitUrl = req.url.split("/");
    const slug = splitUrl[2];
    const config = routeData[splitUrl[1]];

    const result = await payload.find({
      collection: config.collection,
      where: { slug: { equals: slug } },
      limit: 1,
    });

    if (result.totalDocs === 0) {
      return reply.status(404).send("Not Found");
    }

    if (config.collection === "plumber") {
      const address = encodeURIComponent(result.docs[0].contact_us.address.split(" ").join("+"));
      const query = encodeURIComponent(result.docs[0].header.company_name.split(" ").join("+"));
      const location = `https://www.google.com/maps/embed/v1/place?q=${query}+${address}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      result.docs[0].contact_us.location = result.docs[0].contact_us.location || location;
    }

    const data = { ...result.docs[0], url: process.env.BASE_URL + req.url };

    if (splitUrl[3] === "services") {
      reply.view(config.template + "/services-inner.html", {
        ...data,
        service_index: splitUrl[4].split(".")[0],
      });
    } else {
      reply.view(config.template + "/" + splitUrl[3], data);
    }
  } catch (err) {
    console.error(`Error: ${err}`);
    reply.status(500).send("Internal Server Error");
  }
}

fastify.get("/ping", async (_, reply) => {
  reply.send("pong 🏓");
});

fastify.get("/", async (_, reply) => {
  reply.status(200).send({ message: "Hello there!" });
});

Object.keys(routeData).forEach((key) => {
  fastify.get(`/${key}/:slug/*`, async (req, reply) => {
    await renderTemplate(req, reply);
  });
});

const start = async () => {
  await fastify.listen(3000, (err, address) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    fastify.log.info(`Server listening on ${address}`);
  });
};

start();
