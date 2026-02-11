import { useState, useEffect } from "react"
import {
    Box,
    CircularProgress,
    Alert,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    TextField,
    Typography
} from "@mui/material"
import { Refresh, Search as SearchIcon, Storage } from "@mui/icons-material"
import { getApiBase } from "../api"

export function DbBrowser() {
    const [tables, setTables] = useState<string[]>([])
    const [selectedTable, setSelectedTable] = useState("")
    const [search, setSearch] = useState("")
    const [searchDebounced, setSearchDebounced] = useState("")
    const [data, setData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadTables = async () => {
        setLoading(true)
        setError(null)
        try {
            const base = await getApiBase()
            const r = await fetch(`${base}/api/db/tables`)
            if (!r.ok) throw new Error(await r.text())
            const list = (await r.json()) as string[]
            setTables(list)
            if (list.length > 0 && !selectedTable) setSelectedTable(list[0])
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load tables")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTables()
    }, [])

    useEffect(() => {
        const t = setTimeout(() => setSearchDebounced(search.trim()), 300)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => {
        if (!selectedTable) {
            setData(null)
            return
        }
        let cancelled = false
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ table: selectedTable })
        if (searchDebounced) params.set("search", searchDebounced)
        getApiBase()
            .then((base) => fetch(`${base}/api/db/query?${params}`))
            .then((r) => {
                if (!r.ok) throw new Error(r.statusText)
                return r.json()
            })
            .then((res: { columns: string[]; rows: Record<string, unknown>[] }) => {
                if (!cancelled) setData(res)
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [selectedTable, searchDebounced])

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box
                sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 2,
                    alignItems: "center",
                }}
            >
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Table</InputLabel>
                    <Select
                        value={selectedTable}
                        label="Table"
                        onChange={(e) => setSelectedTable(e.target.value)}
                    >
                        {tables.map((t) => (
                            <MenuItem key={t} value={t}>
                                {t}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField
                    size="small"
                    placeholder="Search in table..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ minWidth: 220 }}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: "action.active", fontSize: 20 }} />,
                    }}
                />
                <Button startIcon={<Refresh />} onClick={loadTables}>
                    Refresh
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading && !data ? (
                <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress />
                </Box>
            ) : data ? (
                <TableContainer sx={{ flex: 1, overflow: "auto" }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {data.columns.map((c) => (
                                    <TableCell key={c} sx={{ fontWeight: 600 }}>
                                        {c}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={data.columns.length} align="center" sx={{ color: "text.secondary" }}>
                                        No rows{searchDebounced ? " matching search" : ""}.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.rows.map((row, i) => (
                                    <TableRow key={i} hover>
                                        {data.columns.map((c) => (
                                            <TableCell key={c} sx={{ fontFamily: "monospace" }}>
                                                {row[c] !== null && row[c] !== undefined ? (
                                                    String(row[c])
                                                ) : (
                                                    <span style={{ opacity: 0.5 }}>NULL</span>
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
                    <Storage sx={{ fontSize: 48, opacity: 0.2, mb: 2 }} />
                    <Typography>Select a table to view data</Typography>
                </Box>
            )}
        </Box>
    )
}
