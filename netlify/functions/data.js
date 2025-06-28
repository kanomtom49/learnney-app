const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
});

// Helper function to extract ID from path
const getID = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
}

exports.handler = async (event) => {
    const { httpMethod, path } = event;
    const body = event.body ? JSON.parse(event.body) : null;

    try {
        // GET all data
        if (httpMethod === 'GET' && path.endsWith('/data')) {
            const subjects = await sql`SELECT * FROM subjects ORDER BY name`;
            const topics = await sql`SELECT * FROM topics`;
            return { statusCode: 200, body: JSON.stringify({ subjects, topics }) };
        }

        // POST (Create) a subject
        if (httpMethod === 'POST' && path.endsWith('/data/subjects')) {
            const { id, name } = body;
            const result = await sql`INSERT INTO subjects (id, name) VALUES (${id}, ${name}) RETURNING *`;
            return { statusCode: 201, body: JSON.stringify(result[0]) };
        }

        // POST (Create) a topic
        if (httpMethod === 'POST' && path.endsWith('/data/topics')) {
            const { id, name, subjectId, nextReview } = body;
            const result = await sql`INSERT INTO topics (id, name, subject_id, next_review) VALUES (${id}, ${name}, ${subjectId}, ${nextReview}) RETURNING *`;
            return { statusCode: 201, body: JSON.stringify(result[0]) };
        }

        // PUT (Update) a subject name
        if (httpMethod === 'PUT' && path.includes('/data/subjects/')) {
            const id = getID(path);
            const { name } = body;
            await sql`UPDATE subjects SET name = ${name} WHERE id = ${id}`;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // PUT (Update) a topic name
        if (httpMethod === 'PUT' && path.includes('/data/topics/') && body.name) {
            const id = getID(path);
            const { name } = body;
            await sql`UPDATE topics SET name = ${name} WHERE id = ${id}`;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // PUT (Update) topic rating
        if (httpMethod === 'PUT' && path.includes('/rating')) {
            const id = getID(path.replace('/rating', ''));
            const { topicData } = body;
            await sql`UPDATE topics SET 
                stability = ${topicData.stability},
                difficulty = ${topicData.difficulty},
                state = ${topicData.state},
                last_review = ${topicData.lastReview},
                next_review = ${topicData.nextReview},
                review_history = ${JSON.stringify(topicData.reviewHistory)}::jsonb
             WHERE id = ${id}`;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // PUT (Update) topic reflection
        if (httpMethod === 'PUT' && path.includes('/reflection')) {
            const id = getID(path.replace('/reflection', ''));
            const { reflectionHistory } = body;
            await sql`UPDATE topics SET reflection_history = ${JSON.stringify(reflectionHistory)}::jsonb WHERE id = ${id}`;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // DELETE a subject
        if (httpMethod === 'DELETE' && path.includes('/data/subjects/')) {
            const id = getID(path);
            await sql`DELETE FROM subjects WHERE id = ${id}`;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // DELETE a topic
        if (httpMethod === 'DELETE' && path.includes('/data/topics/')) {
            const id = getID(path);
            await sql`DELETE FROM topics WHERE id = ${id}`;
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 404, body: 'Not Found' };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};