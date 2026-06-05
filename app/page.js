"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase.js";

const temporaryCategories = [
  "ขายผัก",
  "ขายผลไม้",
  "ขายกับข้าว",
  "ขายของแห้ง",
  "ขายเสื้อผ้า",
  "ขายของใช้",
  "ขายอื่น ๆ",
];

const expenseTypes = [
  "ค่าไฟ",
  "ค่าน้ำ",
  "ค่าขยะ",
  "ค่าทำความสะอาด",
  "ค่าซ่อมแซม",
  "ค่าอื่น ๆ",
];

const amountOptions = [20, 30, 40, 50, 80, 100];
const expenseAmountOptions = [50, 100, 200, 300, 500, 1000];

function getTodayString() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export default function Home() {
  const scannerRef = useRef(null);

  const [stalls, setStalls] = useState([]);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [lastScan, setLastScan] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [collections, setCollections] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [showTemporary, setShowTemporary] = useState(false);
  const [temporaryCategory, setTemporaryCategory] = useState("");
  const [temporaryAmount, setTemporaryAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState("");

  const [showReport, setShowReport] = useState(false);
  const [reportFromDate, setReportFromDate] = useState(getTodayString());
  const [reportToDate, setReportToDate] = useState(getTodayString());
  const [reportCollections, setReportCollections] = useState([]);
  const [reportExpenses, setReportExpenses] = useState([]);
  const [reportLoaded, setReportLoaded] = useState(false);

  const [showExpense, setShowExpense] = useState(false);
  const [expenseType, setExpenseType] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(null);
  const [customExpenseAmount, setCustomExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  async function loadStalls() {
    const { data, error } = await supabase
      .from("stalls")
      .select("*")
      .eq("is_active", true)
      .order("stall_code", { ascending: true });

    if (error) {
      console.error("Load stalls error:", error);
      setMessage("โหลดข้อมูลแผงไม่สำเร็จ");
      return;
    }

    setStalls(data || []);
  }

  async function loadTodayData() {
    const today = getTodayString();

    const { data: collectionData, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("collection_date", today)
      .order("created_at", { ascending: false });

    if (collectionError) {
      console.error("Load collections error:", collectionError);
      setMessage("โหลดรายการรับเงินไม่สำเร็จ");
      return;
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .select("*")
      .eq("expense_date", today)
      .order("created_at", { ascending: false });

    if (expenseError) {
      console.error("Load expenses error:", expenseError);
      setMessage("โหลดรายจ่ายไม่สำเร็จ");
      return;
    }

    setCollections(collectionData || []);
    setExpenses(expenseData || []);
  }

  async function startScanner() {
    setMessage("");
    setSelectedStall(null);
    setShowTemporary(false);
    setShowExpense(false);

    if (scannerRunning) {
      return;
    }

    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (e) {
          console.warn("Clear old scanner error:", e);
        }

        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      console.log("Available cameras:", cameras);

      if (!cameras || cameras.length === 0) {
        setMessage("ไม่พบกล้องในเครื่อง");
        return;
      }

      const backCamera =
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("back")
        ) ||
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("rear")
        ) ||
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("environment")
        ) ||
        cameras[cameras.length - 1];

      await scanner.start(
        backCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          const scannedCode = decodedText.trim();
          setLastScan(scannedCode);

          const stall = stalls.find(
            (item) => item.stall_code === scannedCode
          );

          if (stall) {
            setSelectedStall(stall);
            setMessage(`พบแผง ${stall.stall_code} ${stall.stall_name}`);
          } else {
            setSelectedStall(null);
            setMessage(`ไม่พบรหัสแผง: ${scannedCode}`);
          }

          await stopScanner();
        },
        () => {}
      );

      setScannerRunning(true);
      setMessage("เปิดกล้องแล้ว กรุณาสแกน QR");
    } catch (error) {
      console.error("Camera error:", error);

      const errorMessage =
        error?.message ||
        error?.name ||
        JSON.stringify(error) ||
        "unknown error";

      setMessage(`เปิดกล้องไม่สำเร็จ: ${errorMessage}`);
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (error) {
      console.error("Stop scanner error:", error);
    }

    setScannerRunning(false);
  }

  function openTemporaryMode() {
    setShowTemporary(true);
    setShowExpense(false);
    setSelectedStall(null);
    setMessage("");
    setTemporaryCategory("");
    setTemporaryAmount(null);
    setCustomAmount("");
    stopScanner();
  }

  function openExpenseMode() {
    setShowExpense(true);
    setShowTemporary(false);
    setSelectedStall(null);
    setMessage("");
    setExpenseType("");
    setExpenseAmount(null);
    setCustomExpenseAmount("");
    setExpenseNote("");
    stopScanner();
  }

  function openReportMode() {
    setShowReport(true);
    setShowTemporary(false);
    setShowExpense(false);
    setSelectedStall(null);
    setMessage("");
    stopScanner();
  }

  async function saveRegularCollection(paymentMethod) {
    if (!selectedStall) {
      setMessage("ยังไม่ได้เลือกแผง");
      return;
    }

    setLoading(true);

    const paidAmount =
      paymentMethod === "unpaid" ? 0 : Number(selectedStall.daily_fee);

    const newRecord = {
      collection_date: getTodayString(),
      record_type: "regular",
      stall_code: selectedStall.stall_code,
      stall_name: selectedStall.stall_name,
      category: selectedStall.category,
      amount_due: Number(selectedStall.daily_fee),
      amount_paid: paidAmount,
      payment_method: paymentMethod,
      note: "",
    };

    const { data, error } = await supabase
      .from("collections")
      .insert(newRecord)
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Save regular collection error:", error);
      setMessage("บันทึกรับเงินไม่สำเร็จ");
      return;
    }

    setCollections([data, ...collections]);
    setMessage(`บันทึก ${selectedStall.stall_name} ${paidAmount} บาทแล้ว`);
    setSelectedStall(null);
    setLastScan("");
  }

  async function saveTemporaryCollection(paymentMethod) {
    const finalAmount =
      temporaryAmount === "custom"
        ? Number(customAmount)
        : Number(temporaryAmount);

    if (!temporaryCategory) {
      setMessage("กรุณาเลือกประเภทสินค้า");
      return;
    }

    if (!finalAmount || finalAmount <= 0) {
      setMessage("กรุณาเลือกหรือกรอกยอดเงิน");
      return;
    }

    setLoading(true);

    const newRecord = {
      collection_date: getTodayString(),
      record_type: "temporary",
      stall_code: "OTHER",
      stall_name: "แผงอื่น ๆ",
      category: temporaryCategory,
      amount_due: finalAmount,
      amount_paid: finalAmount,
      payment_method: paymentMethod,
      note: "",
    };

    const { data, error } = await supabase
      .from("collections")
      .insert(newRecord)
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Save temporary collection error:", error);
      setMessage("บันทึกแผงอื่น ๆ ไม่สำเร็จ");
      return;
    }

    setCollections([data, ...collections]);
    setMessage(`บันทึกแผงอื่น ๆ ${temporaryCategory} ${finalAmount} บาทแล้ว`);

    setTemporaryCategory("");
    setTemporaryAmount(null);
    setCustomAmount("");
  }

  async function saveExpense() {
    const finalAmount =
      expenseAmount === "custom"
        ? Number(customExpenseAmount)
        : Number(expenseAmount);

    if (!expenseType) {
      setMessage("กรุณาเลือกประเภทรายจ่าย");
      return;
    }

    if (!finalAmount || finalAmount <= 0) {
      setMessage("กรุณาเลือกหรือกรอกยอดรายจ่าย");
      return;
    }

    setLoading(true);

    const newExpense = {
      expense_date: getTodayString(),
      expense_type: expenseType,
      amount: finalAmount,
      note: expenseNote,
    };

    const { data, error } = await supabase
      .from("expenses")
      .insert(newExpense)
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Save expense error:", error);
      setMessage("บันทึกรายจ่ายไม่สำเร็จ");
      return;
    }

    setExpenses([data, ...expenses]);
    setMessage(`บันทึกรายจ่าย ${expenseType} ${finalAmount} บาทแล้ว`);

    setExpenseType("");
    setExpenseAmount(null);
    setCustomExpenseAmount("");
    setExpenseNote("");
  }

  async function deleteCollection(id) {
  const confirmDelete = window.confirm("ต้องการลบรายการรับเงินนี้ใช่ไหม?");

  if (!confirmDelete) {
    return;
  }

  setLoading(true);

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id);

  setLoading(false);

  if (error) {
    console.error("Delete collection error:", error);
    setMessage("ลบรายการรับเงินไม่สำเร็จ");
    return;
  }

  setCollections(collections.filter((item) => item.id !== id));
  setMessage("ลบรายการรับเงินแล้ว");
}

async function deleteExpense(id) {
  const confirmDelete = window.confirm("ต้องการลบรายจ่ายนี้ใช่ไหม?");

  if (!confirmDelete) {
    return;
  }

  setLoading(true);

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  setLoading(false);

  if (error) {
    console.error("Delete expense error:", error);
    setMessage("ลบรายจ่ายไม่สำเร็จ");
    return;
  }

  setExpenses(expenses.filter((item) => item.id !== id));
  setMessage("ลบรายจ่ายแล้ว");
}
async function loadReportData() {
  if (!reportFromDate || !reportToDate) {
    setMessage("กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด");
    return;
  }

  if (reportFromDate > reportToDate) {
    setMessage("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
    return;
  }

  setLoading(true);
  setMessage("");

  const { data: collectionData, error: collectionError } = await supabase
    .from("collections")
    .select("*")
    .gte("collection_date", reportFromDate)
    .lte("collection_date", reportToDate)
    .order("collection_date", { ascending: true });

  if (collectionError) {
    console.error("Load report collections error:", collectionError);
    setLoading(false);
    setMessage("โหลดรายงานรับเงินไม่สำเร็จ");
    return;
  }

  const { data: expenseData, error: expenseError } = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", reportFromDate)
    .lte("expense_date", reportToDate)
    .order("expense_date", { ascending: true });

  setLoading(false);

  if (expenseError) {
    console.error("Load report expenses error:", expenseError);
    setMessage("โหลดรายงานรายจ่ายไม่สำเร็จ");
    return;
  }

  setReportCollections(collectionData || []);
  setReportExpenses(expenseData || []);
  setReportLoaded(true);
  setMessage(`โหลดรายงาน ${reportFromDate} ถึง ${reportToDate} แล้ว`);
}
  function getPaymentText(paymentMethod) {
    if (paymentMethod === "cash") return "เงินสด";
    if (paymentMethod === "transfer") return "เงินโอน";
    if (paymentMethod === "unpaid") return "ยังไม่จ่าย";
    return paymentMethod;
  }

  function getRecordTitle(item) {
    if (item.record_type === "temporary") {
      return `แผงอื่น ๆ - ${item.category}`;
    }

    return `${item.stall_code} ${item.stall_name}`;
  }

  function getRecordTime(item) {
    return new Date(item.created_at).toLocaleTimeString("th-TH");
  }

  const cashTotal = collections
    .filter((item) => item.payment_method === "cash")
    .reduce((sum, item) => sum + Number(item.amount_paid), 0);

  const transferTotal = collections
    .filter((item) => item.payment_method === "transfer")
    .reduce((sum, item) => sum + Number(item.amount_paid), 0);

  const unpaidTotal = collections
    .filter((item) => item.payment_method === "unpaid")
    .reduce((sum, item) => sum + Number(item.amount_due), 0);

  const totalIncome = cashTotal + transferTotal;

  const expenseTotal = expenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  const netTotal = totalIncome - expenseTotal;

  const temporaryCount = collections.filter(
    (item) => item.record_type === "temporary"
  ).length;

  const regularCount = collections.filter(
    (item) => item.record_type === "regular"
  ).length;
  const reportCashTotal = reportCollections
  .filter((item) => item.payment_method === "cash")
  .reduce((sum, item) => sum + Number(item.amount_paid), 0);

const reportTransferTotal = reportCollections
  .filter((item) => item.payment_method === "transfer")
  .reduce((sum, item) => sum + Number(item.amount_paid), 0);

const reportUnpaidTotal = reportCollections
  .filter((item) => item.payment_method === "unpaid")
  .reduce((sum, item) => sum + Number(item.amount_due), 0);

const reportIncomeTotal = reportCashTotal + reportTransferTotal;

const reportExpenseTotal = reportExpenses.reduce(
  (sum, item) => sum + Number(item.amount),
  0
);

const reportNetTotal = reportIncomeTotal - reportExpenseTotal;

const reportRegularCount = reportCollections.filter(
  (item) => item.record_type === "regular"
).length;

const reportTemporaryCount = reportCollections.filter(
  (item) => item.record_type === "temporary"
).length;
  useEffect(() => {
    loadStalls();
    loadTodayData();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-4 rounded-2xl bg-white p-5 text-center shadow">
          <h1 className="text-3xl font-bold text-slate-800">เก็บเงินตลาด</h1>
          <p className="mt-2 text-slate-500">
            บันทึกข้อมูลลง Supabase
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            onClick={startScanner}
            disabled={loading}
            className="rounded-2xl bg-green-600 p-4 text-lg font-bold text-white shadow disabled:bg-slate-400"
          >
            สแกนแผง
          </button>

          <button
            onClick={openTemporaryMode}
            disabled={loading}
            className="rounded-2xl bg-blue-600 p-4 text-lg font-bold text-white shadow disabled:bg-slate-400"
          >
            แผงอื่น ๆ
          </button>

          <button
            onClick={openExpenseMode}
            disabled={loading}
            className="rounded-2xl bg-orange-500 p-4 text-lg font-bold text-white shadow disabled:bg-slate-400"
          >
            รายจ่าย
          </button>

          <button
            onClick={openReportMode}
            disabled={loading}
            className="rounded-2xl bg-slate-800 p-4 text-lg font-bold text-white shadow disabled:bg-slate-400"
          >
            รายงาน
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-white p-4 shadow">
          {scannerRunning && (
            <button
              onClick={stopScanner}
              className="mb-3 w-full rounded-2xl bg-red-600 p-4 text-xl font-bold text-white shadow"
            >
              หยุดสแกน
            </button>
          )}

          <div
            id="qr-reader"
            className="min-h-[40px] w-full overflow-hidden rounded-xl bg-slate-200"
          ></div>

        {!scannerRunning && (
          <div className="mt-3 rounded-xl bg-slate-100 p-4 text-center text-slate-400">
            กดปุ่มสแกนแผงเพื่อเปิดกล้อง
          </div>
        )}

          {lastScan && (
            <p className="mt-3 text-center text-sm text-slate-500">
              QR ล่าสุด: {lastScan}
            </p>
          )}

          {loading && (
            <div className="mt-3 rounded-xl bg-blue-100 p-3 text-center text-lg font-bold text-blue-800">
              กำลังบันทึก...
            </div>
          )}

          {message && (
            <div className="mt-3 rounded-xl bg-yellow-100 p-3 text-center text-lg font-bold text-yellow-800">
              {message}
            </div>
          )}
        </div>

        {selectedStall && (
          <div className="mb-4 rounded-2xl bg-white p-5 shadow">
            <h2 className="text-center text-2xl font-bold text-slate-800">
              {selectedStall.stall_code}
            </h2>

            <p className="mt-1 text-center text-xl font-bold text-slate-700">
              {selectedStall.stall_name}
            </p>

            <p className="mt-1 text-center text-slate-500">
              {selectedStall.category}
            </p>

            <div className="my-4 rounded-2xl bg-slate-100 p-4 text-center">
              <p className="text-slate-500">ยอดที่ต้องเก็บ</p>
              <p className="text-4xl font-bold text-slate-900">
                {Number(selectedStall.daily_fee)} บาท
              </p>
            </div>

            <div className="grid gap-3">
              <button
                onClick={() => saveRegularCollection("cash")}
                disabled={loading}
                className="rounded-2xl bg-green-600 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
              >
                จ่ายสด
              </button>

              <button
                onClick={() => saveRegularCollection("transfer")}
                disabled={loading}
                className="rounded-2xl bg-blue-600 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
              >
                โอน
              </button>

              <button
                onClick={() => saveRegularCollection("unpaid")}
                disabled={loading}
                className="rounded-2xl bg-red-600 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
              >
                ยังไม่จ่าย
              </button>
            </div>
          </div>
        )}

        {showTemporary && (
          <div className="mb-4 rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-center text-2xl font-bold text-slate-800">
              แผงอื่น ๆ
            </h2>

            <p className="mb-3 text-lg font-bold text-slate-700">
              เลือกประเภทสินค้า
            </p>

            <div className="mb-5 grid grid-cols-2 gap-3">
              {temporaryCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setTemporaryCategory(category)}
                  className={`rounded-2xl p-4 text-lg font-bold shadow ${
                    temporaryCategory === category
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <p className="mb-3 text-lg font-bold text-slate-700">
              เลือกยอดเงิน
            </p>

            <div className="mb-4 grid grid-cols-3 gap-3">
              {amountOptions.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTemporaryAmount(amount)}
                  className={`rounded-2xl p-4 text-xl font-bold shadow ${
                    temporaryAmount === amount
                      ? "bg-green-600 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {amount}
                </button>
              ))}

              <button
                onClick={() => setTemporaryAmount("custom")}
                className={`rounded-2xl p-4 text-xl font-bold shadow ${
                  temporaryAmount === "custom"
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                อื่น ๆ
              </button>
            </div>

            {temporaryAmount === "custom" && (
              <input
                type="number"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                placeholder="กรอกยอดเงิน"
                className="mb-4 w-full rounded-2xl border border-slate-300 p-4 text-center text-2xl font-bold"
              />
            )}

            <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-center">
              <p className="text-slate-500">รายการที่เลือก</p>
              <p className="mt-1 text-xl font-bold text-slate-800">
                {temporaryCategory || "-"}
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {temporaryAmount === "custom"
                  ? customAmount || 0
                  : temporaryAmount || 0}{" "}
                บาท
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => saveTemporaryCollection("cash")}
                disabled={loading}
                className="rounded-2xl bg-green-600 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
              >
                จ่ายสด
              </button>

              <button
                onClick={() => saveTemporaryCollection("transfer")}
                disabled={loading}
                className="rounded-2xl bg-blue-600 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
              >
                โอน
              </button>
            </div>
          </div>
        )}

        {showExpense && (
          <div className="mb-4 rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-center text-2xl font-bold text-slate-800">
              บันทึกรายจ่าย
            </h2>

            <p className="mb-3 text-lg font-bold text-slate-700">
              เลือกประเภทรายจ่าย
            </p>

            <div className="mb-5 grid grid-cols-2 gap-3">
              {expenseTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setExpenseType(type)}
                  className={`rounded-2xl p-4 text-lg font-bold shadow ${
                    expenseType === type
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <p className="mb-3 text-lg font-bold text-slate-700">
              เลือกยอดรายจ่าย
            </p>

            <div className="mb-4 grid grid-cols-3 gap-3">
              {expenseAmountOptions.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setExpenseAmount(amount)}
                  className={`rounded-2xl p-4 text-xl font-bold shadow ${
                    expenseAmount === amount
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {amount}
                </button>
              ))}

              <button
                onClick={() => setExpenseAmount("custom")}
                className={`rounded-2xl p-4 text-xl font-bold shadow ${
                  expenseAmount === "custom"
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                อื่น ๆ
              </button>
            </div>

            {expenseAmount === "custom" && (
              <input
                type="number"
                value={customExpenseAmount}
                onChange={(event) => setCustomExpenseAmount(event.target.value)}
                placeholder="กรอกยอดรายจ่าย"
                className="mb-4 w-full rounded-2xl border border-slate-300 p-4 text-center text-2xl font-bold"
              />
            )}

            <input
              type="text"
              value={expenseNote}
              onChange={(event) => setExpenseNote(event.target.value)}
              placeholder="หมายเหตุ เช่น บิลค่าไฟเดือนนี้"
              className="mb-4 w-full rounded-2xl border border-slate-300 p-4 text-lg"
            />

            <button
              onClick={saveExpense}
              disabled={loading}
              className="w-full rounded-2xl bg-orange-500 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
            >
              บันทึกรายจ่าย
            </button>
          </div>
        )}
        {showReport && (
  <div className="mb-4 rounded-2xl bg-white p-5 shadow">
    <h2 className="mb-4 text-center text-2xl font-bold text-slate-800">
      รายงานตามช่วงวันที่
    </h2>

    <div className="mb-4 grid grid-cols-2 gap-3">
      <div>
        <label className="mb-1 block text-sm font-bold text-slate-600">
          วันที่เริ่มต้น
        </label>
        <input
          type="date"
          value={reportFromDate}
          onChange={(event) => setReportFromDate(event.target.value)}
          className="w-full rounded-xl border border-slate-300 p-3 text-lg"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold text-slate-600">
          วันที่สิ้นสุด
        </label>
        <input
          type="date"
          value={reportToDate}
          onChange={(event) => setReportToDate(event.target.value)}
          className="w-full rounded-xl border border-slate-300 p-3 text-lg"
        />
      </div>
    </div>

    <button
      onClick={loadReportData}
      disabled={loading}
      className="mb-4 w-full rounded-2xl bg-slate-800 p-5 text-2xl font-bold text-white disabled:bg-slate-400"
    >
      ดูรายงาน
    </button>

    {reportLoaded && (
      <div className="rounded-2xl bg-slate-100 p-4">
        <p className="mb-4 text-center text-lg font-bold text-slate-700">
          {reportFromDate} ถึง {reportToDate}
        </p>

        <div className="grid gap-2 text-lg">
          <div className="flex justify-between">
            <span>เงินสดรวม</span>
            <span className="font-bold">{reportCashTotal} บาท</span>
          </div>

          <div className="flex justify-between">
            <span>เงินโอนรวม</span>
            <span className="font-bold">{reportTransferTotal} บาท</span>
          </div>

          <div className="flex justify-between text-red-600">
            <span>ยอดค้างจ่าย</span>
            <span className="font-bold">{reportUnpaidTotal} บาท</span>
          </div>

          <div className="mt-2 flex justify-between border-t pt-2 text-xl">
            <span className="font-bold">รายรับรวม</span>
            <span className="font-bold">{reportIncomeTotal} บาท</span>
          </div>

          <div className="flex justify-between text-orange-600">
            <span className="font-bold">รายจ่ายรวม</span>
            <span className="font-bold">{reportExpenseTotal} บาท</span>
          </div>

          <div
            className={`mt-2 flex justify-between rounded-xl p-3 text-xl ${
              reportNetTotal >= 0
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            <span className="font-bold">คงเหลือสุทธิ</span>
            <span className="font-bold">{reportNetTotal} บาท</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-white p-3">
            <p className="text-sm text-slate-500">แผงประจำ</p>
            <p className="text-2xl font-bold">{reportRegularCount}</p>
          </div>

          <div className="rounded-xl bg-white p-3">
            <p className="text-sm text-slate-500">แผงอื่น ๆ</p>
            <p className="text-2xl font-bold">{reportTemporaryCount}</p>
          </div>

          <div className="rounded-xl bg-white p-3">
            <p className="text-sm text-slate-500">รายจ่าย</p>
            <p className="text-2xl font-bold">{reportExpenses.length}</p>
          </div>
        </div>
      </div>
    )}
  </div>
)}
        <div className="mb-4 rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-xl font-bold text-slate-800">
            สรุปวันนี้
          </h2>

          <div className="grid gap-2 text-lg">
            <div className="flex justify-between">
              <span>เงินสด</span>
              <span className="font-bold">{cashTotal} บาท</span>
            </div>

            <div className="flex justify-between">
              <span>เงินโอน</span>
              <span className="font-bold">{transferTotal} บาท</span>
            </div>

            <div className="flex justify-between text-red-600">
              <span>ยอดค้างจ่าย</span>
              <span className="font-bold">{unpaidTotal} บาท</span>
            </div>

            <div className="mt-2 flex justify-between border-t pt-2 text-xl">
              <span className="font-bold">รายรับรวม</span>
              <span className="font-bold">{totalIncome} บาท</span>
            </div>

            <div className="flex justify-between text-orange-600">
              <span className="font-bold">รายจ่ายรวม</span>
              <span className="font-bold">{expenseTotal} บาท</span>
            </div>

            <div
              className={`mt-2 flex justify-between rounded-xl p-3 text-xl ${
                netTotal >= 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              <span className="font-bold">คงเหลือสุทธิ</span>
              <span className="font-bold">{netTotal} บาท</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-base">
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-slate-500">แผงประจำ</p>
                <p className="text-2xl font-bold">{regularCount}</p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-slate-500">แผงอื่น ๆ</p>
                <p className="text-2xl font-bold">{temporaryCount}</p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-slate-500">รายจ่าย</p>
                <p className="text-2xl font-bold">{expenses.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-xl font-bold text-slate-800">
            รายการรับเงินล่าสุด
          </h2>

          {collections.length === 0 ? (
            <p className="text-center text-slate-400">
              ยังไม่มีรายการบันทึก
            </p>
          ) : (
            <div className="grid gap-3">
              {collections.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-bold text-slate-800">
                      {getRecordTitle(item)}
                    </p>

                    <p className="shrink-0 font-bold">
                      {Number(item.amount_paid)} บาท
                    </p>
                  </div>

                  <div className="mt-1 flex justify-between text-sm text-slate-500">
                    <span>{getPaymentText(item.payment_method)}</span>
                    <span>{getRecordTime(item)}</span>
                  </div>

                  {item.payment_method === "unpaid" && (
                    <p className="mt-1 text-sm font-bold text-red-600">
                      ค้างจ่าย {Number(item.amount_due)} บาท
                    </p>
                  )}
                  <button
                    onClick={() => deleteCollection(item.id)}
                    disabled={loading}
                    className="mt-3 w-full rounded-xl bg-red-100 p-3 text-lg font-bold text-red-700 disabled:bg-slate-200"
                  >
                    ลบรายการนี้
                  </button>   
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-xl font-bold text-slate-800">
            รายจ่ายล่าสุด
          </h2>

          {expenses.length === 0 ? (
            <p className="text-center text-slate-400">ยังไม่มีรายจ่าย</p>
          ) : (
            <div className="grid gap-3">
              {expenses.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-orange-200 bg-orange-50 p-3"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-bold text-slate-800">
                      {item.expense_type}
                    </p>

                    <p className="shrink-0 font-bold text-red-600">
                      -{Number(item.amount)} บาท
                    </p>
                  </div>

                  <div className="mt-1 flex justify-between text-sm text-slate-500">
                    <span>{item.note || "-"}</span>
                    <span>{getRecordTime(item)}</span>
                  </div>
                  <button
                    onClick={() => deleteExpense(item.id)}
                    disabled={loading}
                    className="mt-3 w-full rounded-xl bg-red-100 p-3 text-lg font-bold text-red-700 disabled:bg-slate-200"
                  >
                    ลบรายจ่ายนี้
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}