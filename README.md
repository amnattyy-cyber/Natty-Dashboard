# Retention Performance Command Center

Infographic dashboard สำหรับติดตาม Performance Retention ของ TMH, TOL และ Downsell แบบรายวัน โดยอ่านข้อมูลจาก Google Sheet และมี snapshot สำรองกรณีแหล่งข้อมูลยังไม่พร้อม

หน้าเว็บมี Area Focus Table เปรียบเทียบ July และ August ครบ 15 พื้นที่ พร้อม MoM, Budget Churn, MTD Budget, Over Budget และ Status Tier โดยตารางตอบสนองตามตัวกรองบริการและไฮไลต์พื้นที่ที่เลือก

## อัปเดตข้อมูลรายวัน

1. เปิด Google Sheet จากปุ่มบน dashboard
2. เพิ่มแถวใหม่ใน `Performance_Daily` โดยใช้ Report Date เดียวกันสำหรับทุกพื้นที่และทั้ง TMH/TOL
3. เพิ่มแถวใหม่ใน `Downsell_Area_Daily` โดยใช้ Report Date เดียวกันสำหรับทุกพื้นที่
4. รักษาชื่อคอลัมน์เดิมและกรอกค่าตัวเลขโดยไม่ใส่หน่วยในเซลล์
5. Dashboard จะเลือกวันที่ล่าสุดโดยอัตโนมัติ กด “อัปเดตข้อมูล” เพื่อโหลดใหม่ทันที

ข้อมูลบนเว็บเป็นยอดสรุประดับพื้นที่ ไม่มีชื่อหรือรหัสสาขา

