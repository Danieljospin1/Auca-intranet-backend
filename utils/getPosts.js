const connectionPromise = require('../database & models/databaseConnection');

async function getPostById(postId) {
    const [rows] = await connectionPromise.query(`
        SELECT 
            p.Id,
            CASE 
                WHEN s.StudentId IS NOT NULL THEN s.StudentId 
                ELSE st.Id 
            END AS CreatorId,
            CASE 
                WHEN s.StudentId IS NOT NULL THEN s.Fname 
                ELSE st.Fname 
            END AS Fname,
            CASE 
                WHEN s.StudentId IS NOT NULL THEN s.Lname 
                ELSE st.Lname 
            END AS Lname,
            CASE 
                WHEN s.StudentId IS NOT NULL THEN s.ProfileUrl 
                ELSE st.ProfileUrl 
            END AS ProfileUrl,
            CASE 
                WHEN s.StudentId IS NOT NULL THEN 'Student' 
                ELSE st.Role 
            END AS Role,
            p.Description,
            p.Timestamp,
            f.FileType,
            f.ThumbnailUrl,
            f.FullUrl,
            f.FileSize,
            p.Audience,
            (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS postReactions,
            (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS reactionTypes,
            (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS postComments
        FROM 
            posts p
        LEFT JOIN students s ON p.CreatorId = s.StudentId
        LEFT JOIN staff st ON p.CreatorId = st.Id
        LEFT JOIN postfiles f on p.Id=f.PostId
        WHERE 
            p.Id = ?
        GROUP BY 
            p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
            st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
            p.CreatorId, p.Description, p.Timestamp,f.FileType,
            f.ThumbnailUrl,
            f.FullUrl,
            f.FileSize,
            p.Audience
    `, [postId]);

    return rows?.[0] || console.log('no posts');
}

module.exports = getPostById;
