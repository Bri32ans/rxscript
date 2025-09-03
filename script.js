--=====================================================
--  Mega Staff Script (ServerScriptService)
--=====================================================

local WEBHOOK_URL = "https://discord.com/api/webhooks/1412683240493416500/U-zUIMAHJcZ1bm-vlOBytD3DmmNvxVWQf8E_6J7Ci8fCRtDsb9q1btEsUY376zCl8BEQ"

-- Staff ranks (UserIds -> Rank)
local STAFF = {
    [1684796047] = "Owner",
    [1263549901] = "CoOwner",
    [1970492428] = "Admin",
    [5476508628] = "Mod",
}

-- Allowed commands per rank
local PERMS = {
    Owner   = {"kick","ban","unban","mute","unmute","freeze","unfreeze","pm","tp","goto","bring","heal","kill","speed","jump","fly","nofly","announce","cmds","tag","shutdown","sc"},
    CoOwner = {"kick","ban","unban","mute","unmute","freeze","unfreeze","pm","tp","goto","bring","heal","kill","speed","jump","fly","nofly","announce","cmds","tag","shutdown","sc"},
    Admin   = {"kick","ban","unban","mute","unmute","freeze","unfreeze","pm","tp","goto","bring","heal","kill","speed","jump","fly","nofly","announce","cmds","tag","sc"},
    Mod     = {"kick","mute","unmute","freeze","unfreeze","pm","tp","goto","bring","heal","kill","speed","jump","fly","nofly","cmds","tag","sc"},
}

-- Rank logos (Billboard head tag)
local RANK_LOGO = {
    Owner   = "rbxassetid://18690083416",
    CoOwner = "rbxassetid://18690083416",
    Admin   = "rbxassetid://18690119898",
    Mod     = "rbxassetid://18690127899",
    Default = "rbxassetid://18690127899",
}

-- Cooldowns per command (seconds)
local COOLDOWN = {
    kick=2, ban=2, unban=2, mute=2, unmute=2, freeze=1, unfreeze=1,
    pm=1, tp=1, goto=1, bring=1, heal=1, kill=1, speed=1, jump=1,
    fly=1, nofly=1, announce=5, cmds=1, tag=1, shutdown=5, sc=1
}

--======================
--  SERVICES
--======================
local Players            = game:GetService("Players")
local DataStoreService   = game:GetService("DataStoreService")
local HttpService        = game:GetService("HttpService")
local RunService         = game:GetService("RunService")

local BanStore = DataStoreService:GetDataStore("MegaStaff_Bans")

--======================
--  HELPERS
--======================
local function getRank(userId)
    return STAFF[userId] or "Member"
end

local function hasPerm(rank, command)
    local list = PERMS[rank]
    if not list then return false end
    for _,c in ipairs(list) do
        if c == command then return true end
    end
    return false
end

-- find by UserId or partial Name
local function findPlayer(identifier)
    if not identifier or identifier == "" then return nil end
    local asNum = tonumber(identifier)
    if asNum then
        for _,p in ipairs(Players:GetPlayers()) do
            if p.UserId == asNum then return p end
        end
    end
    local lower = string.lower(identifier)
    for _,p in ipairs(Players:GetPlayers()) do
        if string.sub(string.lower(p.Name),1,#lower) == lower then
            return p
        end
    end
    return nil
end

local function logDiscord(msg)
    if not WEBHOOK_URL or WEBHOOK_URL == "" then return end
    pcall(function()
        HttpService:PostAsync(
            WEBHOOK_URL,
            HttpService:JSONEncode({content = msg}),
            Enum.HttpContentType.ApplicationJson
        )
    end)
end

-- private toast for ONE player
local function privateToast(player, text, seconds)
    seconds = seconds or 4
    local gui = Instance.new("ScreenGui")
    gui.Name = "StaffToast"
    gui.ResetOnSpawn = false
    gui.Parent = player:WaitForChild("PlayerGui")

    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(0.5,0,0.07,0)
    label.Position = UDim2.new(0.25,0,0.05,0)
    label.BackgroundColor3 = Color3.fromRGB(25,25,25)
    label.BackgroundTransparency = 0.2
    label.Text = text
    label.TextColor3 = Color3.fromRGB(255,255,200)
    label.TextScaled = true
    label.Font = Enum.Font.SourceSansBold
    label.Parent = gui

    game:GetService("Debris"):AddItem(gui, seconds)
end

-- alert many staff
local function staffBroadcast(text)
    for _,plr in ipairs(Players:GetPlayers()) do
        if getRank(plr.UserId) ~= "Member" then
            privateToast(plr, text, 6)
        end
    end
end

--======================
--  HEADE TAGS
--======================
local function applyHeadTag(player, rank)
    local char = player.Character
    if not char then return end
    local head = char:FindFirstChild("Head")
    if not head then return end

    local staffData = player:FindFirstChild("StaffData")
    if staffData and staffData:FindFirstChild("TagEnabled") and not staffData.TagEnabled.Value then
        if head:FindFirstChild("StaffTag") then head.StaffTag:Destroy() end
        return
    end

    if head:FindFirstChild("StaffTag") then head.StaffTag:Destroy() end

    local bb = Instance.new("BillboardGui")
    bb.Name = "StaffTag"
    bb.Parent = head
    bb.Adornee = head
    bb.Size = UDim2.new(0,100,0,120)
    bb.StudsOffset = Vector3.new(0,2.5,0)
    bb.AlwaysOnTop = true

    local img = Instance.new("ImageLabel")
    img.BackgroundTransparency = 1
    img.Size = UDim2.new(0,60,0,60)
    img.Position = UDim2.new(0.5,-30,0,0)
    img.Image = RANK_LOGO[rank] or RANK_LOGO.Default
    img.Parent = bb

    local txt = Instance.new("TextLabel")
    txt.BackgroundTransparency = 1
    txt.Size = UDim2.new(1,0,0,32)
    txt.Position = UDim2.new(0,0,0,66)
    txt.Text = rank
    txt.TextScaled = true
    txt.Font = Enum.Font.SourceSansBold
    txt.TextColor3 = Color3.fromRGB(255,255,255)
    txt.TextStrokeTransparency = 0.2
    txt.Parent = bb
end

--======================
--  SIMPLE FLY
--======================
local activeFly = {}

local function setNoclip(char, on)
    for _,v in ipairs(char:GetDescendants()) do
        if v:IsA("BasePart") then
            v.CanCollide = not on
        end
    end
end

local function startFly(player)
    local char = player.Character
    if not char then return end
    local hrp = char:FindFirstChild("HumanoidRootPart")
    local hum = char:FindFirstChildOfClass("Humanoid")
    if not hrp or not hum then return end

    setNoclip(char, true)
    hum.PlatformStand = false

    local rootAtt = hrp:FindFirstChild("FlyAttachment") or Instance.new("Attachment", hrp)
    rootAtt.Name = "FlyAttachment"
    local vf = hrp:FindFirstChild("FlyForce") or Instance.new("VectorForce", hrp)
    vf.Name = "FlyForce"
    vf.Attachment0 = rootAtt
    vf.Force = Vector3.new(0, workspace.Gravity * hrp.AssemblyMass, 0)

    if activeFly[player.UserId] and activeFly[player.UserId].conn then
        activeFly[player.UserId].conn:Disconnect()
    end
    local conn = RunService.Stepped:Connect(function()
        if player.Character ~= char then return end
        setNoclip(char, true)
    end)
    activeFly[player.UserId] = {conn = conn}
end

local function stopFly(player)
    local char = player.Character
    if not char then return end
    local hrp = char:FindFirstChild("HumanoidRootPart")
    if hrp then
        local vf = hrp:FindFirstChild("FlyForce")
        if vf then vf:Destroy() end
        local at = hrp:FindFirstChild("FlyAttachment")
        if at then at:Destroy() end
    end
    setNoclip(char, false)
    if activeFly[player.UserId] and activeFly[player.UserId].conn then
        activeFly[player.UserId].conn:Disconnect()
    end
    activeFly[player.UserId] = nil
end

--======================
--  CMD COOLDOWNS
--======================
local lastUse = {}

local function useAllowed(userId, cmd)
    local now = os.clock()
    lastUse[userId] = lastUse[userId] or {}
    local t = lastUse[userId][cmd] or 0
    local cd = COOLDOWN[cmd] or 0
    if now - t >= cd then
        lastUse[userId][cmd] = now
        return true
    else
        return false, math.max(0, cd - (now - t))
    end
end

--======================
--  COMMAND HANDLER
--======================
local function handleCommand(sender, msg)
    if string.sub(msg,1,1) ~= ":" and string.sub(msg,1,1) ~= "/" then return end
    local split = string.split(string.sub(msg,2), " ")
    local cmd = string.lower(split[1])
    table.remove(split,1)
    local args = split

    local rank = getRank(sender.UserId)
    if not hasPerm(rank, cmd) then return end

    local ok, cdLeft = useAllowed(sender.UserId, cmd)
    if not ok then
        privateToast(sender, "Cooldown: wait "..string.format("%.1f",cdLeft).."s", 2)
        return
    end

    ----------------------------------------
    -- COMMANDS
    ----------------------------------------
    if cmd=="kick" then
        local target = findPlayer(args[1])
        if target then
            target:Kick("Kicked by staff")
            staffBroadcast(sender.Name.." kicked "..target.Name)
            logDiscord(sender.Name.." kicked "..target.Name)
        end

    elseif cmd=="ban" then
        local target = findPlayer(args[1])
        if target then
            pcall(function() BanStore:SetAsync(target.UserId, true) end)
            target:Kick("Banned by staff")
            staffBroadcast(sender.Name.." banned "..target.Name)
            logDiscord(sender.Name.." banned "..target.Name)
        end

    elseif cmd=="unban" then
        local targetId = tonumber(args[1])
        if targetId then
            pcall(function() BanStore:RemoveAsync(targetId) end)
            staffBroadcast(sender.Name.." unbanned "..targetId)
            logDiscord(sender.Name.." unbanned "..targetId)
        end

    elseif cmd=="mute" then
        local target = findPlayer(args[1])
        if target and not target:FindFirstChild("Muted") then
            local f = Instance.new("Folder", target)
            f.Name = "Muted"
            staffBroadcast(sender.Name.." muted "..target.Name)
            logDiscord(sender.Name.." muted "..target.Name)
        end

    elseif cmd=="unmute" then
        local target = findPlayer(args[1])
        if target and target:FindFirstChild("Muted") then
            target.Muted:Destroy()
            staffBroadcast(sender.Name.." unmuted "..target.Name)
            logDiscord(sender.Name.." unmuted "..target.Name)
        end

    elseif cmd=="fly" then
        startFly(sender)
        privateToast(sender, "Fly enabled", 3)

    elseif cmd=="nofly" then
        stopFly(sender)
        privateToast(sender, "Fly disabled", 3)

    elseif cmd=="tag" then
        local sd = sender:FindFirstChild("StaffData")
        if sd then
            local te = sd:FindFirstChild("TagEnabled")
            if te then
                te.Value = not te.Value
                if te.Value then
                    applyHeadTag(sender, rank)
                    privateToast(sender, "HeadTag ON", 3)
                else
                    if sender.Character and sender.Character:FindFirstChild("Head") then
                        local h = sender.Character.Head:FindFirstChild("StaffTag")
                        if h then h:Destroy() end
                    end
                    privateToast(sender, "HeadTag OFF", 3)
                end
            end
        end

    elseif cmd=="cmds" then
        privateToast(sender, "Commands: "..table.concat(PERMS[rank], ", "), 8)
    end
end

--======================
--  PLAYER EVENTS
--======================
Players.PlayerAdded:Connect(function(player)
    local banned = false
    pcall(function() banned = BanStore:GetAsync(player.UserId) end)
    if banned then
        player:Kick("You are banned from this experience.")
        return
    end

    local rank = getRank(player.UserId)
    if rank ~= "Member" then
        local staffData = Instance.new("Folder")
        staffData.Name = "StaffData"
        staffData.Parent = player

        local tagEnabled = Instance.new("BoolValue")
        tagEnabled.Name = "TagEnabled"
        tagEnabled.Value = true
        tagEnabled.Parent = staffData
    end

    player.CharacterAdded:Connect(function()
        local r = getRank(player.UserId)
        if r ~= "Member" then
            stopFly(player)
            task.delay(0.5, function()
                applyHeadTag(player, r)
            end)
        end
    end)

    player.Chatted:Connect(function(msg)
        if player:FindFirstChild("Muted") then
            privateToast(player, "You are muted. Message not sent.", 3)
            return
        end
        handleCommand(player, msg)
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    stopFly(player)
end)
