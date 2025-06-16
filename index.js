const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xxrw3xt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db('assignmentDB');
    const assignmentsCollection = db.collection('assignments');

    // Endpoint to create a new assignment
    app.post('/api/assignments', async (req, res) => {
      const assignment = req.body;
      const result = await assignmentsCollection.insertOne(assignment);
      res.status(201).send(result);
    });

    // Endpoint to get all assignments
    app.get('/api/assignments', async (req, res) => {
      const assignments = await assignmentsCollection.find().toArray();
      res.status(200).send(assignments);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Assignment Code Cooking');
});

app.listen(port, () => {
  console.log(`Assignment code server is running on port ${port}`);
});