const express = require('express');
const router = express.Router();
const bigquery = require('../db/index');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to convert image to base64
function fileToGenerativePart(path, mimeType) {
  const data = fs.readFileSync(path);
  return {
    inlineData: {
      data: Buffer.from(data).toString('base64'),
      mimeType
    }
  };
}

// Apply auth middleware to all routes
router.use(authMiddleware);

router.post('/solve', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    const mimeType = req.file.mimetype;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const imagePart = fileToGenerativePart(imagePath, mimeType);

    // Prompt for the model with Markdown formatting
    const prompt = `
      Please solve this math problem step by step and display by language in the image. 
      Show your work and explain each step clearly.
      Format your response using Markdown:
      - Use **bold** for emphasis
      - Use bullet points for steps
      - Use \`code\` blocks for equations
      - Number each major step
      
      Example format:
      
      **Step 1: Understanding the problem**
      * Given equation: \`2x + 5 = 13\`
      * We need to solve for x
      
      **Step 2: Solving**
      * Subtract 5 from both sides: \`2x = 8\`
      * Divide both sides by 2: \`x = 4\`
      
      **Solution:** x = 4
    `;

    // Generate content
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Save the solution to BigQuery
    const userId = req.user.id;
    const query = `
      INSERT INTO math_solver.solved_problems 
      (user_id, image_url, problem_text, solution)
      VALUES (@userId, @imageUrl, @problemText, @solution)
    `;

    const options = {
      query: query,
      params: {
        userId: userId,
        imageUrl: req.file.filename,
        problemText: prompt,
        solution: text
      }
    };

    await bigquery.query(options);

    // Clean up
    fs.unlinkSync(imagePath);

    // Send the complete solution
    res.json({ solution: text });

  } catch (error) {
    console.error('Error solving problem:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await bigquery.query({
      query: `
        SELECT * FROM math_solver.solved_problems 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `,
      params: { userId: userId }
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 