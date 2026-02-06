import { useState, useEffect } from "react"
import {
    Box,
    Button,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions,
    Paper,
    Divider,
    Alert
} from "@mui/material"
import { Add, Edit, Refresh, Save } from "@mui/icons-material"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (window as any).api

interface SocialAdapter {
    platform: string;
    baseUrl: string;
    loginUrl: string;
    profileUrlTemplate: string;
    profileScript: string;
    connections: {
        followersUrlTemplate?: string;
        followingUrlTemplate?: string;
        listSelector: string;
        listScript: string;
    };
}

const DEFAULT_ADAPTER: SocialAdapter = {
    platform: "new-platform",
    baseUrl: "https://example.com",
    loginUrl: "https://example.com/login",
    profileUrlTemplate: "https://example.com/u/{id}",
    profileScript: "return { username: document.title }",
    connections: {
        listSelector: ".list-item",
        listScript: "return []"
    }
}

export function RulesManager() {
    const [adapters, setAdapters] = useState<SocialAdapter[]>([])
    const [loading, setLoading] = useState(false)

    // Editor State
    const [openEditor, setOpenEditor] = useState(false)
    const [editingAdapter, setEditingAdapter] = useState<SocialAdapter | null>(null)
    const [jsonText, setJsonText] = useState("")
    const [error, setError] = useState<string | null>(null)

    const loadAdapters = async () => {
        if (!api?.scraper?.getAdapters) return
        setLoading(true)
        try {
            const list = await api.scraper.getAdapters()
            setAdapters(list)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAdapters()
    }, [])

    const handleEdit = (adapter: SocialAdapter) => {
        setEditingAdapter(adapter)
        setJsonText(JSON.stringify(adapter, null, 2))
        setError(null)
        setOpenEditor(true)
    }

    const handleAddNew = () => {
        setEditingAdapter(null)
        setJsonText(JSON.stringify(DEFAULT_ADAPTER, null, 2))
        setError(null)
        setOpenEditor(true)
    }

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(jsonText) as SocialAdapter
            if (!parsed.platform) throw new Error("Platform name is required")

            await api.scraper.saveAdapter(parsed)
            setOpenEditor(false)
            loadAdapters()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid JSON")
        }
    }

    return (
        <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>Scraping Rules</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={handleAddNew}>
                    New Rule
                </Button>
                <IconButton onClick={loadAdapters} sx={{ ml: 1 }}><Refresh /></IconButton>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Define how to scrape different sites using JSON adapters.
            </Typography>

            <Paper variant="outlined">
                <List>
                    {adapters.length === 0 ? (
                        <ListItem>
                            <ListItemText primary="No rules defined" secondary="Create a new rule to start scraping a new site." />
                        </ListItem>
                    ) : adapters.map((a) => (
                        <ListItem key={a.platform} divider>
                            <ListItemText
                                primary={a.platform}
                                secondary={a.baseUrl}
                            />
                            <ListItemSecondaryAction>
                                <IconButton edge="end" onClick={() => handleEdit(a)}>
                                    <Edit />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                </List>
            </Paper>

            <Dialog open={openEditor} onClose={() => setOpenEditor(false)} maxWidth="md" fullWidth>
                <DialogTitle>{editingAdapter ? `Edit ${editingAdapter.platform}` : "New Rule"}</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <TextField
                        multiline
                        fullWidth
                        minRows={15}
                        maxRows={25}
                        value={jsonText}
                        onChange={e => setJsonText(e.target.value)}
                        sx={{ fontFamily: "monospace" }}
                        margin="dense"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEditor(false)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" startIcon={<Save />}>
                        Save Rule
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
