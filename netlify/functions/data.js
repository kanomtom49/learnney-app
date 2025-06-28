// 1. เรียกใช้ library 'postgres' ที่เราติดตั้งไป
const postgres = require('postgres');

// 2. ส่วนที่สำคัญที่สุด: สร้างการเชื่อมต่อกับฐานข้อมูล
// โดยดึงค่า DATABASE_URL มาจาก Environment Variable ที่เราตั้งค่าบนเว็บ Netlify
const sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
});

// 3. นี่คือฟังก์ชันหลักที่ Netlify จะเรียกใช้เมื่อมี request เข้ามา
exports.handler = async (event, context) => {
    // เราจะเขียนโค้ดทั้งหมดในนี้
    try {
        // ตรวจสอบว่า request ที่เข้ามาเป็นแบบ GET (ขอข้อมูล) หรือไม่
        if (event.httpMethod === 'GET') {

            // 4. สั่งให้ไปดึงข้อมูลจากตาราง subjects และ topics
            const subjects = await sql`SELECT * FROM subjects ORDER BY name`;
            const topics = await sql`SELECT * FROM topics`;

            // 5. ส่งข้อมูลที่ได้กลับไปให้ Frontend
            return {
                statusCode: 200, // 200 แปลว่าสำเร็จ
                body: JSON.stringify({ subjects, topics }), // แปลงข้อมูลเป็น JSON text
            };
        }

        // ถ้าไม่ใช่ GET ให้แจ้งว่าไม่เจอ (เผื่อไว้สำหรับอนาคต)
        return { statusCode: 404, body: 'Not Found' };

    } catch (error) {
        // ถ้ามีข้อผิดพลาดเกิดขึ้นระหว่างการเชื่อมต่อหรือดึงข้อมูล
        console.error(error);
        return {
            statusCode: 500, // 500 แปลว่า Server มีปัญหา
            body: JSON.stringify({ error: 'Failed to connect to database' }),
        };
    }
};