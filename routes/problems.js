const express = require('express');
const router = express.Router();
const bigquery = require('../db/index');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { VertexAI, HarmCategory, HarmBlockThreshold } = require('@google-cloud/vertexai');
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

// Initialize Vertex AI
const project = 'gemetry';
const location = 'us-central1';
const visionModel = 'gemini-2.0-flash-exp';

const vertexAI = new VertexAI({ project: project, location: location });
const generativeVisionModel = vertexAI.getGenerativeModel({
  model: visionModel,
  safetySettings: [{
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
  }],
  systemInstruction: {
    role: 'system',
    parts: [{ text: 'You are a math solver with images, your name is Geometry. You will be given a math problem and you will need to solve it step by step. Do not answer questions, only solve math problems. Respond only in Vietnamese.' }]
  }
});

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
    const imagePart = fileToGenerativePart(imagePath, mimeType);

    // Prompt for the model with Markdown formatting
    const prompt = `
      Please solve this math problem step by step and **respond only in Vietnamese**. 
      Show your work and explain each step clearly.
      Format your response using Markdown:
      - Use **bold** for emphasis
      - Use bullet points for steps
      - Use $$ for math equations (LaTeX format)
      - Number each major step
      
      Example format:
      
      **Bước 1: Hiểu bài toán**
      * Phương trình đã cho: $2x + 5 = 13$
      * Cần tìm giá trị của $x$
      
      **Bước 2: Giải phương trình**
      * Trừ cả 2 vế cho 5: $2x = 8$
      * Chia cả 2 vế cho 2: $x = 4$
      
      **Kết quả:** $x = 4$
    `;

    // Generate content using Vertex AI
    const result = await generativeVisionModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }]
    });
    const response = await result.response;
    const text = response.candidates[0].content.parts[0].text;

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
