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

// Middleware to check if the user is authorized to mark
const canMarkSubmission = async (req, res, next) => {
  const { userEmail } = req.body;
  const id = req.params.id;

  if (!userEmail) {
    return res.status(400).send({ message: 'User email is required' });
  }

  try {
    const submission = await client.db('assignmentDB').collection('submissions').findOne({ _id: new ObjectId(id) });
    if (!submission) {
      return res.status(404).send({ message: 'Submission not found' });
    }
    if (submission.userEmail === userEmail) {
      return res.status(403).send({ message: 'You cannot mark your own submission' });
    }
    next();
  } catch (error) {
    console.error('Error checking submission ownership:', error);
    res.status(500).send({ message: 'Server error' });
  }
};

async function run() {
  try {
    await client.connect();
    console.log('Attempting MongoDB connection...');
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');

    const db = client.db('assignmentDB');
    const assignmentsCollection = db.collection('assignments');
    const submissionsCollection = db.collection('submissions');

    // Existing endpoints (unchanged)
    app.post('/api/assignments', async (req, res) => {
      try {
        const assignment = req.body;
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

    app.get('/api/assignments', async (req, res) => {
      try {
        const assignments = await assignmentsCollection.find().toArray();
        res.status(200).send(assignments);
      } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

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

    app.put('/api/assignments/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const userEmail = req.body.userEmail;
        const updatedAssignment = req.body;

        if (!userEmail) {
          return res.status(400).send({ message: 'User email is required' });
        }

        const assignment = await assignmentsCollection.findOne({ _id: new ObjectId(id) });
        if (!assignment) {
          return res.status(404).send({ message: 'Assignment not found' });
        }

        if (assignment.userEmail !== userEmail) {
          return res.status(403).send({ message: 'You are not authorized to update this assignment' });
        }

        if (
          !updatedAssignment.title ||
          !updatedAssignment.description ||
          !updatedAssignment.marks ||
          !updatedAssignment.thumbnailUrl ||
          !updatedAssignment.difficulty ||
          !updatedAssignment.dueDate ||
          !updatedAssignment.userEmail ||
          !updatedAssignment.userName
        ) {
          return res.status(400).send({ message: 'All fields are required' });
        }

        const result = await assignmentsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title: updatedAssignment.title,
              description: updatedAssignment.description,
              marks: parseInt(updatedAssignment.marks),
              thumbnailUrl: updatedAssignment.thumbnailUrl,
              difficulty: updatedAssignment.difficulty,
              dueDate: updatedAssignment.dueDate,
              userEmail: updatedAssignment.userEmail,
              userName: updatedAssignment.userName,
            },
          }
        );

        if (result.modifiedCount === 1) {
          res.status(200).send({ message: 'Assignment updated successfully' });
        } else {
          res.status(500).send({ message: 'Failed to update assignment' });
        }
      } catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.delete('/api/assignments/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const userEmail = req.body.userEmail;
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

    app.post('/api/assignments/:id/submit', async (req, res) => {
      try {
        const id = req.params.id;
        const submission = req.body;

        if (!submission.googleDocsLink || !submission.userEmail || !submission.userName) {
          return res.status(400).send({ message: 'Google Docs link, user email, and user name are required' });
        }

        const assignment = await assignmentsCollection.findOne({ _id: new ObjectId(id) });
        if (!assignment) {
          return res.status(404).send({ message: 'Assignment not found' });
        }

        const submissionData = {
          assignmentId: id,
          title: assignment.title,
          marks: parseInt(assignment.marks),
          googleDocsLink: submission.googleDocsLink,
          notes: submission.notes || '',
          userEmail: submission.userEmail,
          userName: submission.userName,
          status: 'pending',
          submittedAt: new Date(),
          obtainedMarks: null,
          feedback: null,
        };

        const result = await submissionsCollection.insertOne(submissionData);
        res.status(201).send({ message: 'Assignment submitted successfully', submissionId: result.insertedId });
      } catch (error) {
        console.error('Error submitting assignment:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    // New endpoint to get all submissions (pending and completed)
    app.get('/api/submissions', async (req, res) => {
      try {
        console.log('Fetching all submissions...');
        const allSubmissions = await submissionsCollection.find().toArray();
        res.status(200).send(allSubmissions);
      } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.get('/api/submissions/pending', async (req, res) => {
      try {
        console.log('Fetching pending submissions...');
        const pendingSubmissions = await submissionsCollection
          .find({ status: 'pending' })
          .toArray();
        console.log('Submissions found:', pendingSubmissions);
        res.status(200).send(pendingSubmissions);
      } catch (error) {
        console.error('Error fetching pending submissions:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.put('/api/submissions/:id/mark', canMarkSubmission, async (req, res) => {
      try {
        const id = req.params.id;
        const { obtainedMarks, feedback } = req.body;

        if (!obtainedMarks || isNaN(obtainedMarks) || obtainedMarks < 0) {
          return res.status(400).send({ message: 'Valid marks are required' });
        }

        const result = await submissionsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              obtainedMarks: parseInt(obtainedMarks),
              feedback: feedback || '',
              status: 'completed',
              markedAt: new Date(),
            },
          }
        );

        if (result.modifiedCount === 1) {
          res.status(200).send({ message: 'Submission marked successfully' });
        } else {
          res.status(404).send({ message: 'Submission not found' });
        }
      } catch (error) {
        console.error('Error marking submission:', error);
        res.status(500).send({ message: 'Server error' });
      }
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message, error.stack);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Assignment Code Cooking');
});

app.listen(port, () => {
  console.log(`Assignment code server is running on port ${port}`);
});