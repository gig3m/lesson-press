-- resources/pdf/filters/fenced-divs.lua

local envs = {
  ['read']        = 'readpill',
  ['scripture']   = 'scripturebox',
  ['say']         = 'saybox',
  ['ask']         = 'askbox',
  ['prayer']      = 'prayerbox',
  ['discussion']  = 'discussionbox',
  ['question']    = 'questionbox',
  ['key-truth']   = 'keytruthbox',
  ['note']        = 'notebox',
  ['transition']  = 'transitionbox',
  ['materials']   = 'materialsbox',
  ['journal']     = 'journalbox',
}

-- True if a Para has exactly one inline child which is an Emph.
-- That matches the canonical "italic-only paragraph" used as an answer
-- inside :::discussion list items.
local function is_italic_only_para(para)
  if para.t ~= 'Para' then return false end
  if #para.content ~= 1 then return false end
  return para.content[1].t == 'Emph'
end

local function emph_to_plain_text(emph)
  -- Render the inner inlines as a LaTeX fragment via pandoc.write.
  local doc = pandoc.Pandoc({ pandoc.Plain(emph.content) })
  return pandoc.write(doc, 'latex')
end

-- Walks an OrderedList inside a :::discussion div. For each list item,
-- if its last block is an italic-only Para, replace it with a RawBlock
-- containing \answerparagraph{...}.
local function rewrite_answers_in_list(ol)
  for _, item in ipairs(ol.content) do
    local last = item[#item]
    if last and is_italic_only_para(last) then
      local latex = emph_to_plain_text(last.content[1])
      -- Trim trailing newline pandoc.write adds.
      latex = latex:gsub('[\r\n]+$', '')
      item[#item] = pandoc.RawBlock('latex', '\\answerparagraph{' .. latex .. '}')
    end
  end
end

function Div(el)
  local cls = el.classes[1]
  if cls == nil then return nil end
  local env = envs[cls]
  if env == nil then return nil end

  if cls == 'discussion' then
    for _, block in ipairs(el.content) do
      if block.t == 'OrderedList' then
        rewrite_answers_in_list(block)
      end
    end
  end

  local open = pandoc.RawBlock('latex', '\\begin{' .. env .. '}')
  local close = pandoc.RawBlock('latex', '\\end{' .. env .. '}')
  local result = { open }
  for _, block in ipairs(el.content) do
    table.insert(result, block)
  end
  table.insert(result, close)
  return result
end
