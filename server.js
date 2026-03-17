const express = require('express');
const multer = require('multer');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');

// 1. IMPORT THE AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// 2. INITIALIZE GEMINI (It reads the secret key you just added)
const genAI = new GoogleGenerativeAI(process.env.AIzaSyD_8sVvUDBi-rJMFXKMXFI30cNiFu03SAg);

const upload = multer({ dest: 'uploads/' });
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function: Turns the uploaded image into a format the AI can read
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

app.post('/generate-exam', upload.array('sourceFiles'), async (req, res) => {
    const { classLevel, subject, examType } = req.body;
    const files = req.files;

    try {
        console.log("Sending images to AI for extraction...");

        // 3. THIS IS THE BRAIN
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Prepare all uploaded images
        const imageParts = files.map(file => fileToGenerativePart(file.path, file.mimetype));

        // Tell the AI what to do
        const prompt = `You are an assistant for Indo Oxford Academy. Look at these uploaded textbook pages. Extract all the questions you see. Sort them into: MCQ, Fill in the blanks, True/False, Match the following, and Short Answer.`;

        // Call the AI
        const result = await model.generateContent([prompt, ...imageParts]);
        const aiResponseText = result.response.text();
        
        console.log("AI Extraction Complete!");

        // 4. PUT THE AI TEXT INTO THE DOCX
        const studentDoc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: "Indo Oxford Academy, Lohardaga", bold: true, size: 40, color: "1A237E" })],
                        alignment: "center"
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: `Exam: ${examType}   Class: ${classLevel}   Subject: ${subject}`, bold: true, size: 34 })],
                        alignment: "center",
                        spacing: { after: 400 }
                    }),
                    // For this test, we are just dumping the raw AI output into the document to make sure it can "see".
                    new Paragraph({ text: aiResponseText }) 
                ]
            }]
        });

        const buffer = await Packer.toBuffer(studentDoc);

        // Delete the images from the server to save space
        files.forEach(file => fs.unlinkSync(file.path));

        // Send the file to your phone
        res.setHeader('Content-Disposition', `attachment; filename=Class${classLevel}_${subject}_${examType}.docx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).send("Error generating document. Check your server console.");
    }
});

app.listen(port, () => {
    console.log(`Indo Oxford AI Server running on port ${port}`);
});
