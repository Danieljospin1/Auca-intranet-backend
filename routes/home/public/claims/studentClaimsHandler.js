const express = require('express');
const router = express.Router();
const connectionPromise = require('../../../../database & models/databaseConnection');
const { Authenticate } = require('../../../../Authentication/authentication');
const multer = require('multer');
const uploadImage = require("../../../../fileHandler/uploadFile");
const upload = require("../../../../fileHandler/upload");


//creating post claim that will be used by students to submit a claim from a particular post, claim submittion include this but some are not a must:
//1-PostId (a must)
//2-ClaimText (a must)
//3-ClaimCategory (a must)
//4-ClaimEvidenceImageFile (not a must)
//5-ClaimVisibility(a must) (public or private)
router.post('/newClaim', upload.single('ClaimEvidenceImageFile'), Authenticate, async (req, res) => {
    const { ClaimText, NewClaimCategoryText, ClaimVisibility } = req.body;
    const userId = req.user.Id;
    const PostId = Number(req.body.PostId);
    const ClaimCategoryId = Number(req.body.ClaimCategoryId);

    console.log("Received claim submission:", { PostId, ClaimText, ClaimCategoryId, NewClaimCategoryText, ClaimVisibility, userId });

    // ── Validation ───────────────────────────────
    if (!PostId || !ClaimText || (!ClaimCategoryId && !NewClaimCategoryText) || !ClaimVisibility) {
        return res.status(400).json({ message: 'PostId, ClaimText, Category and ClaimVisibility are required' });
    }

    if (ClaimVisibility !== 'public' && ClaimVisibility !== 'private') {
        return res.status(400).json({ message: 'ClaimVisibility must be either public or private' });
    }

    if (!ClaimCategoryId && NewClaimCategoryText && NewClaimCategoryText.length > 50) {
        return res.status(400).json({ message: 'New category name must be 50 characters or less' });
    }

    // ── Image upload ─────────────────────────────
    let ClaimEvidenceImageFile = null;
    if (req.file) {
        try {
            const { originalUrl } = await uploadImage(req.file.buffer, "claims", req.file.mimetype, req.file.originalname);
            ClaimEvidenceImageFile = originalUrl;
        } catch (error) {
            console.error("Image upload error:", error);
            return res.status(500).json({ message: 'Error uploading image' });
        }
    }

    try {
        // ── Case 1: student uses an existing category ──
        if (ClaimCategoryId) {
            await connectionPromise.query(
                `INSERT INTO claims (StudentId, ClaimText, CategoryId, ClaimEvidenceUrl, VisibilityStatus)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, ClaimText, ClaimCategoryId, ClaimEvidenceImageFile, ClaimVisibility]
            );
            console.log("Claim submitted with existing category:", ClaimCategoryId);
            return res.status(201).json({ message: 'Claim submitted successfully' });
        }

        // ── Case 2: student creates a new category ──
        if (!ClaimCategoryId && NewClaimCategoryText) {
            const [newCategoryResult] = await connectionPromise.query(
                `INSERT INTO claimCategory (PostId, CreatedById, CategoryName)
                 VALUES (?, ?, ?)`,
                [PostId, userId, NewClaimCategoryText.trim()]
            );
            const newCategoryId = newCategoryResult.insertId;

            await connectionPromise.query(
                `INSERT INTO claims (StudentId, ClaimText, CategoryId, ClaimEvidenceUrl, VisibilityStatus)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, ClaimText, newCategoryId, ClaimEvidenceImageFile, ClaimVisibility]
            );
            console.log("Claim submitted with new category:", NewClaimCategoryText);
            return res.status(201).json({ message: 'Claim submitted successfully' });
        }

    } catch (error) {
        console.error("Error submitting claim:", error);
        return res.status(500).json({ message: 'Error submitting claim', error: error.message });
    }
});
//creating get claim route that will be used by students to get claimCategories ids,category names and number of claims under each category of a particular post, this will help students to decide which category to choose when submitting a claim, and also to know how many claims are there under each category for a particular post

router.get('/categories', Authenticate, async (req, res) => {
    const PostId = Number(req.query.PostId);
    if (!PostId || isNaN(PostId)) {
        return res.status(400).json({ message: 'PostId is required or its not valid' });
    }
    try {
        const [claimCategories] = await connectionPromise.query(`SELECT
    cc.CategoryId,
    cc.CategoryName,
    COUNT(c.ClaimId) AS NumberOfClaims
FROM claimCategory cc
LEFT JOIN claims c
    ON c.CategoryId = cc.CategoryId where cc.PostId=?
GROUP BY cc.CategoryId, cc.CategoryName
ORDER BY cc.CategoryName`, [PostId]);
        return res.status(200).json(claimCategories);

    } catch (error) {
        return res.status(500).json({ message: 'Error fetching claim categories', error: error.message });
    }
});

//creating get claims route to get all claims of a particular category id and number of supports for each claim,student names, student ids,this will help students to know which claim is more supported by other students and also to know the details of each claim before supporting it
router.get('/categories/:claimCategoryId', Authenticate, async (req, res) => {
    const { claimCategoryId } = req.params;
    const userId = req.user.Id;
    if (!claimCategoryId) {
        return res.status(400).json({ message: 'ClaimCategoryId is required' });
    }
    try {
        //check if the claimCategoryId is valid and exist in the database
        const [category] = await connectionPromise.query(`select * from claimCategory where CategoryId=?`, [claimCategoryId]);
        if (category.length === 0) {
            return res.status(404).json({ message: 'Claim category not found' });
        }
        const [claims] = await connectionPromise.query(`SELECT 
  claims.*,
  s.Lname,
  COUNT(cs.ClaimId) AS NumberOfSupports,
  MAX(CASE WHEN cs.StudentId = ? THEN 1 ELSE 0 END) AS isSupportedByMe,
  MAX(CASE WHEN claims.StudentId = ? THEN 1 ELSE 0 END) AS isOwner
FROM claims
LEFT JOIN claimSupport cs ON claims.ClaimId = cs.ClaimId
LEFT JOIN students s ON claims.StudentId = s.StudentId
WHERE claims.CategoryId = ?
GROUP BY claims.ClaimId`, [userId, userId, claimCategoryId]);
        return res.status(200).json(claims);
    } catch (error) {
        return res.status(500).json({ message: `Error fetching claims in category ${claimCategoryId}`, error: error.message });
    }
});

//creating post claim support route that will be used by students to support a claim, this will increase the number of supports for that claim and also add the student id to the list of supporters for that claim, this will help other students to know how many supports a claim has and who are the supporters for that claim
router.post('/newClaimSupport', Authenticate, async (req, res) => {
    const { ClaimId } = req.body;
    const userId = req.user.Id;
    if (!ClaimId || typeof (ClaimId) !== 'number') {
        return res.status(400).json({ message: 'ClaimId is required or its not valid' });
    }
    try {
        // Check if the student has already supported the claim
        const [existingSupport] = await connectionPromise.query(`select * from claimSupport where ClaimId=? and StudentId=?`, [ClaimId, userId]);
        if (existingSupport.length > 0) {
            await connectionPromise.query(`delete from claimSupport where ClaimId=? and StudentId=?`, [ClaimId, userId]);
            return res.status(200).json({ message: 'Claim support removed successfully' });
        }
        // Insert support record
        await connectionPromise.query(`insert into claimSupport (ClaimId, StudentId) values (?,?)`, [ClaimId, userId]);
        return res.status(200).json({ message: 'Claim supported successfully' });
    } catch (error) {
        console.error('Error checking claim support:', error);
        return res.status(500).json({ message: 'Error checking claim support', error: error.message });
    }
});



//creating delete claim route that will be used by students to delete their claim if they want to
router.delete('/deleteClaim/:claimId', Authenticate, async (req, res) => {
    const claimId = parseInt(req.params.claimId, 10);

    //validate 0 claimId and db error code: code: 'ER_NO_REFERENCED_ROW_2'
    if (!claimId || typeof (claimId) !== 'number') {
        return res.status(400).json({ message: 'ClaimId is required or its not valid' });
    }

    try {
        const [claim] = await connectionPromise.query(`select * from claims where ClaimId=? and StudentId=?`, [claimId, req.user.Id]);
        if (claim.length === 0) {
            return res.status(404).json({ message: 'Claim not found or you are not the owner' });
        }
        await connectionPromise.query(`delete from claims where ClaimId=? and StudentId=?`, [claimId, req.user.Id]);
        return res.status(200).json({ message: 'Claim deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Error deleting claim', error: error.message });
    }
});

module.exports = router;
