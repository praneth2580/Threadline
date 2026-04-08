import { useState, useEffect, useCallback } from "react"
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
    Typography,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Tooltip
} from "@mui/material"
import { Refresh, Search as SearchIcon, Storage, DeleteOutline } from "@mui/icons-material"
import { getApiBase } from "../api"

export function DbBrowser() {
    const [tables, setTables] = useState<string[]>([])
    const [selectedTable, setSelectedTable] = useState("")
    const [search, setSearch] = useState("")
    const [searchDebounced, setSearchDebounced] = useState("")
    const [data, setData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<{ table: string; row: Record<string, unknown> } | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadTables = useCallback(async () => {
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
    }, [selectedTable])

    const loadData = useCallback(async () => {
        if (!selectedTable) {
            setData(null)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const base = await getApiBase()
            const params = new URLSearchParams({ table: selectedTable })
            if (searchDebounced) params.set("search", searchDebounced)
            const r = await fetch(`${base}/api/db/query?${params}`)
            if (!r.ok) throw new Error(r.statusText)
            const res = await r.json()
            setData(res)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load data")
        } finally {
            setLoading(false)
        }
    }, [searchDebounced, selectedTable])

    useEffect(() => {
        loadTables()
    }, [loadTables])

    useEffect(() => {
        const t = setTimeout(() => setSearchDebounced(search.trim()), 300)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleDelete = async () => {
        if (!deleteConfirm) return
        const { table, row } = deleteConfirm

        // Find a suitable PK (id is preferred)
        const pk = Object.keys(row).find(k => k === 'id' || k === 'username' || k.endsWith('_id'))
        if (!pk) {
            setError("Could not identify primary key for deletion")
            setDeleteConfirm(null)
            return
        }

        setDeleting(true)
        try {
            const base = await getApiBase()
            const params = new URLSearchParams({ table, pk, id: String(row[pk]) })
            const r = await fetch(`${base}/api/db/row?${params}`, { method: 'DELETE' })
            if (!r.ok) throw new Error(await r.text())

            setDeleteConfirm(null)
            loadData() // Refresh current view
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete row")
        } finally {
            setDeleting(false)
        }
    }

    const formatValue = (col: string, val: unknown) => {
        if (val === null || val === undefined) return <span style={{ opacity: 0.5 }}>NULL</span>

        // Format columns ending in _timestamp or exactly 'created_at' if it's a number
        if (col.endsWith("_timestamp") || col === "created_at") {
            const num = Number(val)
            if (!isNaN(num) && num > 1000000000) {
                const ms = num < 10000000000 ? num * 1000 : num
                return new Date(ms).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            }
        }

        return String(val)
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: 'background.default' }}>
            <Box
                sx={{
                    p: 2.5,
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
                        sx={{ borderRadius: 2 }}
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
                    sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: "action.active", fontSize: 20 }} />,
                    }}
                />
                <Button
                    startIcon={<Refresh />}
                    onClick={loadTables}
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                >
                    Refresh
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ m: 2, borderRadius: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading && !data ? (
                <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress />
                </Box>
            ) : data ? (
                <>
                    <Box sx={{ px: 2.5, pb: 2.5, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                        <Box
                            className="glass-panel amber-glow"
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                borderRadius: 4,
                                border: "1px solid",
                                borderColor: "divider",
                                overflow: "hidden",
                                boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
                            }}
                        >
                            <TableContainer className="custom-scrollbar" sx={{ height: "100%", overflow: "auto" }}>
                                <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    {data.columns.map((c) => (
                                        <TableCell key={c} sx={{
                                            fontWeight: 800,
                                            bgcolor: 'background.paper',
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            letterSpacing: '0.05em',
                                            color: 'text.secondary',
                                            borderBottom: 2,
                                            borderColor: 'divider'
                                        }}>
                                            {c}
                                        </TableCell>
                                    ))}
                                    <TableCell sx={{
                                        fontWeight: 800,
                                        bgcolor: 'background.paper',
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                        letterSpacing: '0.05em',
                                        color: 'text.secondary',
                                        borderBottom: 2,
                                        borderColor: 'divider',
                                        width: 60
                                    }}>
                                        Actions
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={data.columns.length + 1} align="center" sx={{ p: 4, color: "text.secondary" }}>
                                            No rows{searchDebounced ? " matching search" : ""}.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.rows.map((row, i) => (
                                        <TableRow key={i} hover>
                                            {data.columns.map((c) => (
                                                <TableCell key={c} sx={{
                                                    fontFamily: (c.endsWith('_id') || c === 'id') ? "monospace" : "inherit",
                                                    fontSize: '0.875rem',
                                                    borderColor: 'divider'
                                                }}>
                                                    {formatValue(c, row[c])}
                                                </TableCell>
                                            ))}
                                            <TableCell sx={{ borderColor: 'divider' }}>
                                                <Tooltip title="Delete Row">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setDeleteConfirm({ table: selectedTable, row })}
                                                        sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
                                                    >
                                                        <DeleteOutline fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                            </TableContainer>
                        </Box>
                    </Box>

                    <Dialog
                        open={Boolean(deleteConfirm)}
                        onClose={() => !deleting && setDeleteConfirm(null)}
                        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
                    >
                        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Deletion</DialogTitle>
                        <DialogContent>
                            <DialogContentText>
                                Are you sure you want to delete this row from <strong>{deleteConfirm?.table}</strong>?
                                This action cannot be undone.
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2 }}>
                            <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
                            <Button
                                onClick={handleDelete}
                                variant="contained"
                                color="error"
                                disabled={deleting}
                                startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
                            >
                                {deleting ? "Deleting..." : "Delete Permanently"}
                            </Button>
                        </DialogActions>
                    </Dialog>
                </>
            ) : (
                <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
                    <Storage sx={{ fontSize: 48, opacity: 0.2, mb: 2 }} />
                    <Typography>Select a table to view data</Typography>
                </Box>
            )}
        </Box>
    )
}
