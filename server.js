const express = require('express');
const multer = require('multer');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');

// 1. IMPORT ANTHROPIC SDK
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const port = process.env.PORT || 3000;

// 2. INITIALIZE CLAUDE
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const upload = multer({ dest: 'uploads/' });
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/generate-exam', upload.array('sourceFiles'), async (req, res) => {
    const { classLevel, subject, examType } = req.body;
    const files = req.files;

    try {
        console.log("Sending images to Claude AI for extraction...");

        // Prepare content array for Claude
        const contentArray = [];

        // Add images to content
        files.forEach(file => {
            const base64Data = Buffer.from(fs.readFileSync(file.path)).toString("base64");
            contentArray.push({
                type: "image",
                source: {
                    type: "base64",
                    media_type: file.mimetype,
                    data: base64Data
                }
            });
        });

        // Add text prompt to content
        contentArray.push({
            type: "text",
            text: "You are an assistant for Indo Oxford Academy. Look at these uploaded textbook pages. Extract all the questions you see. Sort them into: MCQ, Fill in the blanks, True/False, Match the following, and Short Answer."
        });

        // 3. CALL CLAUDE API (Using Claude 3.5 Sonnet for excellent vision)
        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022", 
            max_tokens: 4000,
            messages: [{ role: "user", content: contentArray }]
        });

        const aiResponseText = msg.content[0].text;
        
        console.log("Claude AI Extraction Complete!");

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
        console.error("Claude AI Error:", error);
        res.status(500).send("Error generating document. Check your server console.");
    }
});

app.listen(port, () => {
    console.log(`Indo Oxford Claude Server running on port ${port}`);
});
