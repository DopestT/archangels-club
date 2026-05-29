import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const INTERVALS = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

function formatPrice(price) {
  if (price < 0.0001) return price.toExponential(4)
  if (price < 0.01) return price.toFixed(6)
  return price.toFixed(4)
}

function formatDate(ts, days) {
  const d = new Date(ts)
  if (days <= 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label, days }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 13,
    }}>
      <div style={{ color: '#8b949e', marginBottom: 4 }}>{formatDate(label, days)}</div>
      <div style={{ color: '#58a6ff', fontWeight: 600 }}>${formatPrice(payload[0].value)}</div>
    </div>
  )
}

export default function FloatingChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [interval, setInterval] = useState(INTERVALS[1])
  const [currentPrice, setCurrentPrice] = useState(null)
  const [priceChange, setPriceChange] = useState(null)

  // drag state
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const cardRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/terra-luna/market_chart?vs_currency=usd&days=${interval.days}`
      )
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const json = await res.json()
      const prices = json.prices.map(([ts, price]) => ({ ts, price }))
      setData(prices)
      if (prices.length) {
        const first = prices[0].price
        const last = prices[prices.length - 1].price
        setCurrentPrice(last)
        setPriceChange(((last - first) / first) * 100)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [interval])

  useEffect(() => { fetchData() }, [fetchData])

  // Refresh every 60s
  useEffect(() => {
    const id = window.setInterval(fetchData, 60_000)
    return () => window.clearInterval(id)
  }, [fetchData])

  const onMouseDown = (e) => {
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      setPos({
        x: dragStart.current.px + e.clientX - dragStart.current.mx,
        y: dragStart.current.py + e.clientY - dragStart.current.my,
      })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const isUp = priceChange >= 0
  const accentColor = isUp ? '#3fb950' : '#f85149'
  const gradientId = 'luncGrad'

  return (
    <div
      ref={cardRef}
      style={{
        position: 'relative',
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        width: 480,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 16,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header / drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          cursor: 'grab',
          padding: '16px 20px 12px',
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f4a522, #e64a19)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            L
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>LUNC / USD</div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>Terra Luna Classic</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {currentPrice != null && (
            <div style={{ fontWeight: 700, fontSize: 18 }}>${formatPrice(currentPrice)}</div>
          )}
          {priceChange != null && (
            <div style={{ fontSize: 12, color: accentColor }}>
              {isUp ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Interval tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 20px' }}>
        {INTERVALS.map((iv) => (
          <button
            key={iv.label}
            onClick={() => setInterval(iv)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              background: interval.label === iv.label ? accentColor : '#21262d',
              color: interval.label === iv.label ? '#fff' : '#8b949e',
              transition: 'background 0.15s',
            }}
          >
            {iv.label}
          </button>
        ))}
        <button
          onClick={fetchData}
          style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: 20,
            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: '#21262d', color: '#8b949e',
          }}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Chart */}
      <div style={{ padding: '0 8px 16px', height: 220 }}>
        {loading && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: 13 }}>
            Loading…
          </div>
        )}
        {error && !loading && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f85149', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
            {error}
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis
                dataKey="ts"
                tickFormatter={(ts) => formatDate(ts, interval.days)}
                tick={{ fill: '#8b949e', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v) => `$${formatPrice(v)}`}
                tick={{ fill: '#8b949e', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip days={interval.days} />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={accentColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: accentColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid #21262d',
        fontSize: 11,
        color: '#484f58',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Data: CoinGecko</span>
        <span>Auto-refresh every 60s</span>
      </div>
    </div>
  )
}
