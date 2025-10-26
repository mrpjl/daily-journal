const START_DATE = new Date('2025-05-01');
const API_URL = 'http://localhost:3000/api'; // Ensure this matches the server's base URL

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Application initialized. Loading heatmap...');
    
    // Add meta description for SEO
    const metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    metaDescription.content = 'Track your daily emotions and visualize them in a heatmap. Add notes and tags to reflect on your emotional journey.';
    document.head.appendChild(metaDescription);

    document.getElementById('date').valueAsDate = new Date();

    // Attach the addEntry function to the button
    document.getElementById('addEntryButton').addEventListener('click', addEntry);

    await renderHeatMap();
    console.log('Heatmap loaded successfully.');
});

function getEmotionColor(score) {
    if (score === null) return '#ebedf0';

    // Assign distinct colors for each value from -5 to 5
    const colorPalette = {
        '-5': '#b71c1c', // Dark red
        '-4': '#d32f2f', // Red
        '-3': '#f44336', // Light red
        '-2': '#ff7043', // Orange
        '-1': '#ffcc80', // Light orange
         '0': '#ebedf0', // Neutral gray
         '1': '#c8e6c9', // Light green
         '2': '#81c784', // Green
         '3': '#4caf50', // Dark green
         '4': '#388e3c', // Deeper green
         '5': '#1b5e20'  // Deepest green
    };

    return colorPalette[score] || '#ebedf0'; // Default to neutral if score is invalid
}

function getEmotionState(score) {
    const emotionStates = {
        '-5': 'Very Angry',
        '-4': 'Angry',
        '-3': 'Frustrated',
        '-2': 'Upset',
        '-1': 'Sad',
         '0': 'Neutral',
         '1': 'Content',
         '2': 'Happy',
         '3': 'Very Happy',
         '4': 'Excited',
         '5': 'Ecstatic'
    };
    return emotionStates[score] || 'Unknown';
}

async function loadData() {
    console.log('Fetching scores for heatmap from the server...');
    try {
        const response = await fetch(`${API_URL}/emotions/heatmap`);
        if (!response.ok) {
            throw new Error('Failed to load heatmap data');
        }
        console.log('Scores for heatmap fetched successfully.');
        return await response.json();
    } catch (error) {
        console.error('Error loading heatmap data:', error);
        alert('Failed to load heatmap data. Make sure the server is running.');
        return {};
    }
}

async function saveData(date, score, notes, tags) {
    console.log(`Saving data for date: ${date}, score: ${score}, tags: ${tags}`);
    try {
        const response = await fetch(`${API_URL}/emotions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date, score, notes, tags })
        });

        if (!response.ok) {
            throw new Error('Failed to save data');
        }

        console.log('Data saved successfully.');
        return await response.json();
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Failed to save emotion entry. Make sure the server is running.');
        throw error;
    }
}

async function addEntry() {
    const dateInput = document.getElementById('date').value;
    const emotionInput = parseInt(document.getElementById('emotion').value);
    const notesInput = document.getElementById('notes').value;

    // Collect selected tags
    const tags = Array.from(document.querySelectorAll('#tagsCheckboxes input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value)
        .join('-');

    console.log('Adding new entry...');
    if (!dateInput || isNaN(emotionInput)) {
        console.warn('Validation failed: Missing date or invalid emotion score.');
        alert('Please fill in all fields');
        return;
    }

    if (emotionInput < -5 || emotionInput > 5) {
        console.warn('Validation failed: Emotion score out of range.');
        alert('Emotion score must be between -5 and 5');
        return;
    }

    if (!tags) {
        console.warn('Validation failed: No tags selected.');
        alert('Please select at least one tag');
        return;
    }

    try {
        await saveData(dateInput, emotionInput, notesInput, tags);
        await renderHeatMap();
        console.log('New entry added successfully.');
        alert('Entry added successfully!');
    } catch (error) {
        // Error already handled in saveData
    }
}

function getMonthsBetween(startDate, endDate) {
    const months = [];
    const current = new Date(startDate);
    current.setDate(1);
    
    while (current <= endDate) {
        months.push({
            month: current.getMonth(),
            year: current.getFullYear(),
            label: current.toLocaleDateString('en-US', { month: 'short' })
        });
        current.setMonth(current.getMonth() + 1);
    }
    
    return months;
}

function renderMonthLabels(startDate, endDate) {
    const monthsLabels = document.getElementById('monthsLabels');
    monthsLabels.innerHTML = '';

    const months = getMonthsBetween(startDate, endDate);
    months.forEach((month, index) => {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = month.label;
        monthLabel.style.flex = '1';
        monthsLabels.appendChild(monthLabel);
    });
}

function adjustTooltipPosition(cell, tooltip) {
    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = cellRect.top + window.scrollY - tooltipRect.height - 8; // Default: above the cell
    let left = cellRect.left + window.scrollX + (cellRect.width / 2) - (tooltipRect.width / 2);

    // Adjust if the tooltip goes out of the viewport
    if (top < window.scrollY) {
        top = cellRect.bottom + window.scrollY + 8; // Move below the cell
    }
    if (left < window.scrollX) {
        left = window.scrollX + 8; // Align to the left edge
    } else if (left + tooltipRect.width > viewportWidth + window.scrollX) {
        left = viewportWidth + window.scrollX - tooltipRect.width - 8; // Align to the right edge
    }

    // Ensure the tooltip does not go beyond the bottom of the viewport
    if (top + tooltipRect.height > viewportHeight + window.scrollY) {
        top = viewportHeight + window.scrollY - tooltipRect.height - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function showTooltip(cell, text) {
    console.log('Showing tooltip:', text);
    let tooltip = document.querySelector('.tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = text || 'No data available';
    tooltip.style.position = 'absolute';
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';

    adjustTooltipPosition(cell, tooltip);

    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
}

function hideTooltip() {
    console.log('Hiding tooltip.');
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
    }
}

async function renderHeatMap() {
    console.log('Rendering heatmap...');
    const heatMapWrapper = document.querySelector('.heat-map-wrapper');
    heatMapWrapper.innerHTML = '';

    // Fetch heatmap data for hover events
    const heatmapData = await loadData(); // Fetch from /api/emotions/heatmap
    const today = new Date();
    const currentDate = new Date(START_DATE);

    let currentMonth = currentDate.getMonth();
    let monthSection = null;
    let monthBox = null;

    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const scores = heatmapData[dateStr] || [];

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        const averageEmotion = averageScore !== null ? getEmotionState(Math.round(averageScore)) : 'No entry';
        const averageColor = averageScore !== null ? getEmotionColor(Math.round(averageScore)) : getEmotionColor(null);

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.style.background = averageColor;

        const formattedDate = currentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const tooltipText = scores.length > 0
            ? `${formattedDate}: Overall ${averageEmotion} (Avg. Score: ${averageScore.toFixed(2)})`
            : `${formattedDate}: No entry`;

        // Hover event to show tooltip
        cell.addEventListener('mouseenter', () => showTooltip(cell, tooltipText));
        cell.addEventListener('mouseleave', hideTooltip);

        // Click event to fetch detailed data from /api/emotions for the selected date
        cell.addEventListener('click', async () => {
            console.log(`Fetching detailed data for ${formattedDate}...`);
            try {
                const response = await fetch(`${API_URL}/emotions?date=${dateStr}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch detailed data');
                }
                const detailedData = await response.json();
                const entries = detailedData[dateStr] || [];
                displayNotes(formattedDate, entries);
            } catch (error) {
                console.error('Error fetching detailed data:', error);
                alert('Failed to fetch detailed data. Make sure the server is running.');
            }
        });

        // Create a new month section if the month changes or if it's the first iteration
        if (!monthSection || currentDate.getMonth() !== currentMonth) {
            monthSection = document.createElement('div');
            monthSection.className = 'month-section';

            // Add month label
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = currentDate.toLocaleDateString('en-US', {
                month: 'short',
                year: '2-digit'
            });
            monthSection.appendChild(monthLabel);

            // Add the month box
            monthBox = document.createElement('div');
            monthBox.className = 'month-box';
            monthSection.appendChild(monthBox);

            heatMapWrapper.appendChild(monthSection);
            currentMonth = currentDate.getMonth();
        }

        // Append the day cell to the current month's box
        monthBox.appendChild(cell);

        currentDate.setDate(currentDate.getDate() + 1);
    }
    console.log('Heatmap rendered successfully.');
}

function renderMarkdown(text) {
    // Replace newlines with <br> for proper rendering
    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold (**text**)
        .replace(/\*(.+?)\*/g, '<em>$1</em>'); // Italic (*text*)
    return formattedText;
}

function displayNotes(date, notesList) {
    const selectedDateElement = document.getElementById('selectedDate');
    const selectedNotesElement = document.getElementById('selectedNotes');

    selectedDateElement.textContent = `Selected Date: ${date}`;

    // Group notes by tags
    const groupedNotes = notesList.reduce((acc, note) => {
        const tag = note.tags || 'No tags';
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push({
            notes: note.notes,
            emotionState: getEmotionState(note.score) // Include emotion state
        });
        return acc;
    }, {});

    // Render grouped notes with emotion state
    selectedNotesElement.innerHTML = Object.entries(groupedNotes)
        .map(([tag, notes]) => `
            <p><strong>Tag:</strong> ${tag}</p>
            <p><strong>Emotion:</strong> ${notes[0].emotionState}</p>
            <p><strong>Notes:</strong></p>
            <ul>
                ${notes.map(note => `
                    <li>
                        ${renderMarkdown(note.notes)}
                    </li>
                `).join('')}
            </ul>
            <hr>
        `)
        .join('');
}

async function searchNotes(query) {
    console.log(`Searching notes for query: "${query}"`);
    try {
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Failed to search notes');
        }
        const results = await response.json();
        displaySearchResults(results, query);
    } catch (error) {
        console.error('Error searching notes:', error);
        alert('Failed to search notes. Make sure the server is running.');
    }
}

function displaySearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    if (results.length === 0) {
        searchResults.innerHTML = '<p>No matching notes found.</p>';
        return;
    }

    const highlightQuery = (text, query) => {
        const regex = new RegExp(`(${query})`, 'gi'); // Case-insensitive match
        return text.replace(regex, '<mark>$1</mark>'); // Highlight the matching word
    };

    const filterAndFormatText = (text) => {
        return text
            .split('\n') // Split notes into lines
            .filter(line => line.toLowerCase().includes(query.toLowerCase())) // Keep only lines with the query
            .map(line => highlightQuery(line, query)) // Highlight the query in matching lines
            .join('<br>'); // Join the filtered lines with <br> for HTML rendering
    };

    searchResults.innerHTML = `
        <ul>
            ${results.map(result => {
                const filteredNotes = filterAndFormatText(result.notes);
                if (!filteredNotes) return ''; // Skip if no lines match the query
                return `
                    <li>
                        <strong>${result.date}:</strong><br>
                        ${filteredNotes}
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

// Attach search functionality
document.getElementById('searchButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        alert('Please enter a search query.');
        return;
    }
    searchNotes(query);
});

document.getElementById('refreshButton').addEventListener('click', () => {
    console.log('Refreshing search results...');
    document.getElementById('searchInput').value = ''; // Clear the search input field
    document.getElementById('searchResults').innerHTML = ''; // Clear the search results
});
