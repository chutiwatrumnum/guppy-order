import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Chunk 1: State
content = content.replace(
  "  const [showCart, setShowCart] = useState(false);",
  "  const [showCart, setShowCart] = useState(false);\n  const [isBreedModalOpen, setIsBreedModalOpen] = useState(false);"
);

// Chunk 2: handleAddOrUpdateBreed
content = content.replace(
  "setEditingBreed(null);\n      fetchData();",
  "setEditingBreed(null);\n      setIsBreedModalOpen(false);\n      fetchData();"
);

// Chunk 3: The UI
const startIdx = content.indexOf('{isManagingBreeds && isAdmin ? (');
const endIdx = content.indexOf(') : (\n          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-4">');

const originalChunk = content.substring(startIdx, endIdx);
const newViewPath = 'newView.tsx';
const modalPath = 'modal.tsx';

content = content.replace(originalChunk, fs.readFileSync(newViewPath, 'utf8'));
content = content.replace('{/* Edit Order Modal */}', fs.readFileSync(modalPath, 'utf8') + '\n\n      {/* Edit Order Modal */}');

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx Updated!');
