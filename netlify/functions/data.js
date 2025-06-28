// === ไฟล์: netlify/functions/data.js (เวอร์ชันสำหรับทดสอบ) ===

exports.handler = async (event, context) => {

  // โค้ดนี้ไม่ทำอะไรเลยนอกจากส่งข้อมูลว่างๆ กลับไปทันที
  // เพื่อทดสอบว่า Frontend กับ Backend Function คุยกันได้จริงๆ หรือไม่

  const mockData = {
    subjects: [],
    topics: []
  };

  return {
    statusCode: 200, // ส่งสถานะ "สำเร็จ"
    body: JSON.stringify(mockData) // ส่งข้อมูลว่างๆ กลับไป
  };
};