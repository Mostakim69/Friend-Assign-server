const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xxrw3xt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');

    const db = client.db('assignmentDB');
    const assignmentsCollection = db.collection('assignments');

    // Endpoint to create a new assignment
    app.post('/api/assignments', async (req, res) => {
      try {
        const assignment = req.body;
        // Validate required fields
        if (
          !assignment.title ||
          !assignment.description ||
          !assignment.marks ||
          !assignment.thumbnailUrl ||
          !assignment.difficulty ||
          !assignment.dueDate ||
          !assignment.userEmail ||
          !assignment.userName
        ) {
          return res.status(400).send({ message: 'All fields are required' });
        }
        const result = await assignmentsCollection.insertOne(assignment);
        res.status(201).send({ message: 'Assignment created successfully', insertedId: result.insertedId });
      } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Endpoint to get all assignments
    app.get('/api/assignments', async (req, res) => {
      try {
        const assignments = await assignmentsCollection.find().toArray();
        res.status(200).send(assignments);
      } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Endpoint to get a single assignment by ID
    app.get('/api/assignments/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const assignment = await assignmentsCollection.findOne({ _id: new ObjectId(id) });
        if (!assignment) {
          return res.status(404).send({ message: 'Assignment not found' });
        }
        res.status(200).send(assignment);
      } catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // Endpoint to delete an assignment
    app.delete('/api/assignments/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const userEmail = req.body.userEmail; // Expect userEmail in the request body
        if (!userEmail) {
          return res.status(400).send({ message: 'User email is required' });
        }
        const assignment = await assignmentsCollection.findOne({ _id: new ObjectId(id) });
        if (!assignment) {
          return res.status(404).send({ message: 'Assignment not found' });
        }
        if (assignment.userEmail !== userEmail) {
          return res.status(403).send({ message: 'You are not authorized to delete this assignment' });
        }
        const result = await assignmentsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
          res.status(200).send({ message: 'Assignment deleted successfully' });
        } else {
          res.status(500).send({ message: 'Failed to delete assignment' });
        }
      } catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
  // Do not close the client here to keep the connection alive
}

run().catch(console.dir);

// Root endpoint
app.get('/', (req, res) => {
  res.send('Assignment Code Cooking');
});

// Start the server
app.listen(port, () => {
  console.log(`Assignment code server is running on port ${port}`);
});