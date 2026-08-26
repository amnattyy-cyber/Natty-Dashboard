# Retention Performance Command Center

Infographic dashboard สำหรับติดตาม Performance Retention ของ TMH, TOL และ Downsell แบบรายวัน โดยอ่านข้อมูลจาก Google Sheet และมี snapshot สำรองกรณีแหล่งข้อมูลยังไม่พร้อม

หน้าเว็บมี Area Focus Table เปรียบเทียบ July และ August พร้อม MoM, Budget Churn, MTD Budget, Over Budget และ Status Tier โดยตัวกรองทุกตัวควบคุม KPI กราฟ ตาราง Area, Downsell และ Insight พร้อมกัน

กลุ่มพื้นที่ที่รองรับ:

- `ALL` — ครบ 15 Area
- `BMA 5 Area` — BMA I ถึง BMA V
- `UPC1` — Central Northeast, Lower North, Lower Northeast, Upper North และ Upper Northeast
- `UPC2` — Central, East, Upper South, West และ Lower South

Partition `Branch Performance` แสดงผลรายสาขาตามกลุ่ม/Area และบริการที่เลือก โดยเผยแพร่เฉพาะชื่อสาขาและซ่อนรหัส TDS/WW

## อัปเดตข้อมูลรายวัน

1. เปิด Google Sheet จากปุ่มบน dashboard
2. เพิ่มแถวใหม่ใน `Performance_Daily` โดยใช้ Report Date เดียวกันสำหรับทุกพื้นที่และทั้ง TMH/TOL
3. เพิ่มแถวใหม่ใน `Downsell_Area_Daily` โดยใช้ Report Date เดียวกันสำหรับทุกพื้นที่
4. เพิ่ม snapshot ใน `Branch_Performance_Daily` โดยคงชื่อสาขาและไม่เพิ่มคอลัมน์ TDS/WW
5. รักษาชื่อคอลัมน์เดิมและกรอกค่าตัวเลขโดยไม่ใส่หน่วยในเซลล์
6. Dashboard จะเลือกวันที่ล่าสุดโดยอัตโนมัติ กด “อัปเดตข้อมูล” เพื่อโหลดใหม่ทันที

ข้อมูลบนเว็บมีชื่อสาขาเพื่อการติดตาม Performance แต่ไม่มีรหัส TDS/WW
